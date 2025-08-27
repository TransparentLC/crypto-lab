import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream';
import { Blake3Hasher } from '@napi-rs/blake-hash';
import { and, eq, type InferSelectModel, not } from 'drizzle-orm';
import yaml from 'js-yaml';
import StreamZip from 'node-stream-zip';
import parseArgsStringToArgv from 'string-argv';
import wretch from 'wretch';

import config from '../src/config.js';
import db from '../src/database.js';
import { experiments, submissions } from '../src/schema.js';
import { blobFromReadableStream, formdataFromRecord } from '../src/util.js';

// 手动运行评测，结果不写入数据库
// 流程和自动评测基本相同
// pnpm exec tsx scripts/manual-judge.ts {subid}

const procLimit = 64;
const stderrLimit = 4096;
const clockLimitFactor = 1.14514191981;

const sandboxClient = wretch(config.sandbox.endpoint).auth(
    `Bearer ${config.sandbox.token}`,
);

const subid = parseInt(process.argv[2], 10);
const submission = db
    .select()
    .from(submissions)
    .where(and(eq(submissions.subid, subid), not(submissions.obsolete)))
    .get();
if (!submission) {
    throw new Error(`Submission #${subid} not found`);
}

fs.rmSync('manual-judge', { recursive: true, force: true });
fs.mkdirSync('manual-judge');

const result: Partial<InferSelectModel<typeof submissions>> = {
    pending: false,
};
try {
    const experiment = db
        .select()
        .from(experiments)
        .where(eq(experiments.expid, submission.expid))
        .get();
    if (!experiment)
        throw new Error(`Experiment #${submission.expid} not found`);

    // Compile
    if (!(submission.language in experiment.compileCommands))
        throw new Error(`Invalid language ${submission.language}`);
    const codeFile = `code-${crypto.randomUUID()}.${submission.language}`;
    const execFile = `exec-${crypto.randomUUID()}`;
    const compileCommand = experiment.compileCommands[submission.language];
    // log('codeFile', codeFile);
    // log('execFile', execFile);
    // log('compileCommand', compileCommand);

    let execFileId: string;
    if (compileCommand.startsWith('#!')) {
        result.compileSuccess = true;
        result.compileOutput = '';
        execFileId = await sandboxClient
            .post(
                formdataFromRecord({
                    file: new Blob([`${compileCommand}\n${submission.code}`]),
                }),
                '/file',
            )
            .json<string>();
    } else {
        const compileResponse = (
            await sandboxClient
                .post(
                    {
                        cmd: [
                            {
                                args: parseArgsStringToArgv(compileCommand).map(
                                    e => {
                                        // biome-ignore-start lint/suspicious/noTemplateCurlyInString: 占位用，并不是 JS 的模板字符串
                                        if (e === '${input}') return codeFile;
                                        if (e === '${output}') return execFile;
                                        // biome-ignore-end lint/suspicious/noTemplateCurlyInString: 占位用，并不是 JS 的模板字符串
                                        return e;
                                    },
                                ),
                                env: [
                                    'PATH=/sbin:/bin:/usr/bin:/usr/local/bin:/usr/local/sbin',
                                    'LANG=zh_CN.UTF-8',
                                ],
                                files: [
                                    { content: '' },
                                    {
                                        name: 'stdout',
                                        max: config.sizeLimit.compileOutput,
                                    },
                                    {
                                        name: 'stderr',
                                        max: config.sizeLimit.compileOutput,
                                    },
                                ],
                                procLimit,
                                cpuRateLimit: experiment.cpuLimit,
                                cpuLimit: experiment.compileTimeLimit * 1e6,
                                clockLimit: Math.round(
                                    experiment.compileTimeLimit *
                                        clockLimitFactor *
                                        1e6,
                                ),
                                memoryLimit: experiment.compileMemoryLimit,
                                copyIn: {
                                    [codeFile]: { content: submission.code },
                                },
                                copyOut: ['stderr'],
                                copyOutCached: [execFile],
                            },
                        ],
                    } as GoJudge.Request,
                    '/run',
                )
                .json<GoJudge.Result[]>()
        )[0];
        // dir(compileResponse, { depth: null });
        result.compileSuccess = compileResponse.status === 'Accepted';
        result.compileOutput = compileResponse.files?.stderr;
        if (!result.compileSuccess) {
            result.compileOutput = `Compiler error: ${compileResponse.status}\n${result.compileOutput}`;
            console.dir(result, { depth: null });
            process.exit();
        }
        // biome-ignore lint/style/noNonNullAssertion: file ID 必定存在
        execFileId = compileResponse.fileIds![execFile];
    }

    // Judge
    result.result = [];
    const checkpointZip = new StreamZip.async({
        file: path.join('storage', experiment.checkpointPath),
    });
    const checkpointMetadata = yaml.load(
        await checkpointZip
            .entryData('metadata.yaml')
            .then(r => r.toString('utf-8')),
    ) as {
        input: string;
        output: string;
        mode: 'text' | 'binary' | 'special-judge';
        note?: string;
    }[];
    // dir(checkpointMetadata, { depth: null });
    for (const checkpoint of checkpointMetadata) {
        const checkpointInput = await checkpointZip.stream(checkpoint.input);
        const checkpointOutputExpected = await checkpointZip.stream(
            checkpoint.output,
        );
        const checkpointOutputExpectedWrite = fs.createWriteStream(
            `manual-judge/expected-${checkpoint.output}`,
        );
        const checkpointInputFileId = await sandboxClient
            .post(
                formdataFromRecord({
                    file: await blobFromReadableStream(checkpointInput),
                }),
                '/file',
            )
            .json<string>();
        const runResponse = (
            await sandboxClient
                .post(
                    {
                        cmd: [
                            {
                                args: [execFile],
                                env: [
                                    'PATH=/sbin:/bin:/usr/bin:/usr/local/bin:/usr/local/sbin',
                                    'LANG=zh_CN.UTF-8',
                                ],
                                files: [
                                    { fileId: checkpointInputFileId },
                                    {
                                        name: 'stdout',
                                        max: config.sizeLimit.runOutput,
                                    },
                                    { name: 'stderr', max: stderrLimit },
                                ],
                                procLimit,
                                cpuRateLimit: experiment.cpuLimit,
                                cpuLimit: experiment.runTimeLimit * 1e6,
                                clockLimit: Math.round(
                                    experiment.runTimeLimit *
                                        clockLimitFactor *
                                        1e6,
                                ),
                                // 从stdout输出的数据大小也会被计入memoryLimit，输出较长的话会触发MemoryLimitExceeded
                                // biome-ignore-start lint/style/noNonNullAssertion: entry, size 必定存在
                                memoryLimit:
                                    experiment.runMemoryLimit +
                                    (await checkpointZip.entry(
                                        checkpoint.output,
                                    ))!.size,
                                // biome-ignore-end lint/style/noNonNullAssertion: entry, size 必定存在
                                copyIn: {
                                    [execFile]: { fileId: execFileId },
                                },
                                copyOutCached: ['stdout', 'stderr'],
                            },
                        ],
                    } as GoJudge.Request,
                    '/run',
                )
                .json<GoJudge.Result[]>()
        )[0];
        // dir(runResponse, { depth: null });
        const checkpointOutputFileId = runResponse.fileIds?.stdout;
        const checkpointStderrFileId = runResponse.fileIds?.stderr;
        const checkpointStderr = await sandboxClient
            .get(`/file/${runResponse.fileIds?.stderr}`)
            .res(r => r.text());
        console.log('stderr:', checkpointStderr);
        if (runResponse.status === 'Accepted') {
            const checkpointOutput = await sandboxClient
                .get(`/file/${checkpointOutputFileId}`)
                // @ts-expect-error
                // biome-ignore lint/style/noNonNullAssertion: body 必定存在
                .res(r => stream.Readable.fromWeb(r.body!));
            const checkpointOutputWrite = fs.createWriteStream(
                `manual-judge/actual-${checkpoint.output}`,
            );
            let checkpointOutputLength = 0;
            switch (checkpoint.mode) {
                case 'binary': {
                    console.log('binary');
                    const hashKey = crypto.randomBytes(32);
                    const hctxExpected = Blake3Hasher.newKeyed(hashKey);
                    const hctxOutput = Blake3Hasher.newKeyed(hashKey);
                    await Promise.all([
                        new Promise((resolve, reject) =>
                            checkpointOutputExpected
                                .on('data', chunk => {
                                    hctxExpected.update(chunk);
                                    checkpointOutputExpectedWrite.write(chunk);
                                })
                                .on('error', err => reject(err))
                                .on('end', resolve),
                        ),
                        new Promise((resolve, reject) =>
                            checkpointOutput
                                .on('data', chunk => {
                                    hctxOutput.update(chunk);
                                    checkpointOutputWrite.write(chunk);
                                    checkpointOutputLength += chunk.length;
                                })
                                .on('error', err => reject(err))
                                .on('end', resolve),
                        ),
                    ]);
                    const hashExpected = hctxExpected.digestBuffer();
                    const hashOutput = hctxOutput.digestBuffer();
                    console.log('expected blake3 hash', hashExpected);
                    console.log('output   blake3 hash', hashOutput);
                    if (hashExpected.compare(hashOutput))
                        runResponse.status = 'Wrong Answer' as GoJudge.Status;
                    break;
                }
                case 'text': {
                    const checkpointOutputExpectedArray = (
                        (await new Promise((resolve, reject) => {
                            const chunks: Buffer[] = [];
                            checkpointOutputExpected
                                .on('data', chunk => chunks.push(chunk))
                                .on('error', err => reject(err))
                                .on('end', () =>
                                    resolve(Buffer.concat(chunks)),
                                );
                        })) as Buffer
                    )
                        .toString('utf-8')
                        .trim()
                        .split(/\s+/);
                    const checkpointOutputArray = (
                        (await new Promise((resolve, reject) => {
                            const chunks: Buffer[] = [];
                            checkpointOutput
                                .on('data', chunk => {
                                    chunks.push(chunk);
                                    checkpointOutputLength += chunk.length;
                                })
                                .on('error', err => reject(err))
                                .on('end', () =>
                                    resolve(Buffer.concat(chunks)),
                                );
                        })) as Buffer
                    )
                        .toString('utf-8')
                        .trim()
                        .split(/\s+/);
                    checkpointOutputExpectedWrite.write(
                        checkpointOutputExpectedArray.join('\n'),
                    );
                    checkpointOutputWrite.write(
                        checkpointOutputArray.join('\n'),
                    );
                    console.log('text');
                    console.log('expected', checkpointOutputExpectedArray);
                    console.log('output  ', checkpointOutputArray);
                    if (
                        checkpointOutputExpectedArray.length !==
                            checkpointOutputArray.length ||
                        checkpointOutputExpectedArray.some(
                            (e, i) => e !== checkpointOutputArray[i],
                        )
                    )
                        runResponse.status = 'Wrong Answer' as GoJudge.Status;
                    break;
                }
                case 'special-judge': {
                    const specialJudgeFile = `special-judge-${crypto.randomUUID()}`;
                    const checkpointInputFile = `input-${crypto.randomUUID()}`;
                    const checkpointOutputFile = `output-${crypto.randomUUID()}`;
                    const specialJudgeFileId = await sandboxClient
                        .post(
                            formdataFromRecord({
                                file: await blobFromReadableStream(
                                    checkpointOutputExpected,
                                ),
                            }),
                            '/file',
                        )
                        .json<string>();
                    const specialJudgeResponse = (
                        await sandboxClient
                            .post(
                                {
                                    cmd: [
                                        {
                                            args: [
                                                specialJudgeFile,
                                                checkpointInputFile,
                                                checkpointOutputFile,
                                            ],
                                            env: [
                                                'PATH=/sbin:/bin:/usr/bin:/usr/local/bin:/usr/local/sbin',
                                                'LANG=zh_CN.UTF-8',
                                            ],
                                            files: [
                                                { content: '' },
                                                {
                                                    name: 'stdout',
                                                    max: config.sizeLimit
                                                        .runOutput,
                                                },
                                                {
                                                    name: 'stderr',
                                                    max: config.sizeLimit
                                                        .runOutput,
                                                },
                                            ],
                                            procLimit,
                                            cpuRateLimit: experiment.cpuLimit,
                                            cpuLimit:
                                                experiment.compileTimeLimit *
                                                1e6,
                                            clockLimit: Math.round(
                                                experiment.compileTimeLimit *
                                                    clockLimitFactor *
                                                    1e6,
                                            ),
                                            memoryLimit:
                                                experiment.compileMemoryLimit,
                                            copyIn: {
                                                [specialJudgeFile]: {
                                                    fileId: specialJudgeFileId,
                                                },
                                                [checkpointInputFile]: {
                                                    fileId: checkpointInputFileId,
                                                },
                                                [checkpointOutputFile]: {
                                                    fileId: checkpointOutputFileId,
                                                },
                                            },
                                        },
                                    ],
                                } as GoJudge.Request,
                                '/run',
                            )
                            .json<GoJudge.Result[]>()
                    )[0];
                    // log('special-judge', specialJudgeResponse);
                    switch (specialJudgeResponse.exitStatus) {
                        case 0:
                            break;
                        case 1:
                            runResponse.status =
                                'Wrong Answer' as GoJudge.Status;
                            break;
                        default:
                            runResponse.status =
                                'Internal Error' as GoJudge.Status;
                            break;
                    }
                    await sandboxClient
                        .delete(`/file/${specialJudgeFileId}`)
                        .res();
                    break;
                }
            }
            // 减去stdout的部分
            runResponse.memory -= checkpointOutputLength;
            checkpointOutputExpectedWrite.close();
            checkpointOutputWrite.close();
        }
        await Promise.all(
            [
                checkpointInputFileId,
                checkpointOutputFileId,
                checkpointStderrFileId,
            ].map(e => sandboxClient.delete(`/file/${e}`).res()),
        );
        result.result.push({
            time: runResponse.time / 1e6,
            memory: runResponse.memory,
            status: runResponse.status,
            stderr: checkpointStderr,
        });
    }
    await sandboxClient.delete(`/file/${execFileId}`).res();
    result.time = Math.max(...result.result.map(e => e.time));
    result.memory = Math.max(...result.result.map(e => e.memory));
    result.acceptedCount = result.result.filter(
        e => e.status === 'Accepted',
    ).length;
    result.accepted = result.acceptedCount === checkpointMetadata.length;
    console.dir(result, { depth: null });
} catch (err) {
    console.log(err);
    console.dir(
        {
            pending: false,
            compileSuccess: false,
            compileOutput: `Sandbox error:\n${(err as Error).stack || err}`,
        },
        { depth: null },
    );
}
