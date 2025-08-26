import crypto from 'node:crypto';
import EventEmitter from 'node:events';
import path from 'node:path';
import stream from 'node:stream';
import { Blake3Hasher } from '@napi-rs/blake-hash';
import yaml from 'js-yaml';
import StreamZip from 'node-stream-zip';
import wretch from 'wretch';
import parseArgsStringToArgv from 'string-argv';
import { and, asc, eq, lt, ne, not, type InferSelectModel } from 'drizzle-orm';

import config from './config.js';
import db from './database.js';
import { formdataFromRecord, blobFromReadableStream } from './util.js';
import { experiments, submissions, users } from './schema.js';

const procLimit = 16;
const stderrLimit = 4096;
const clockLimitFactor = 1.145141919810;

const sandboxClient = wretch(config.sandbox.endpoint)
    .auth(`Bearer ${config.sandbox.token}`);

const dir: typeof console.dir = (obj, options) => process.env.NODE_ENV === 'production' || console.dir(obj, options);

const log: typeof console.log = (...data) => process.env.NODE_ENV === 'production' || console.log(...data);

export const judge = async (submission: InferSelectModel<typeof submissions>): Promise<Partial<InferSelectModel<typeof submissions>>> => {
    try {
        const result: Partial<InferSelectModel<typeof submissions>> = {
            pending: false,
        };
        const experiment = db
            .select()
            .from(experiments)
            .where(eq(experiments.expid, submission.expid))
            .get();
        if (!experiment) throw new Error(`Experiment #${submission.expid} not found`);

        // Compile
        if (!(submission.language in experiment.compileCommands)) throw new Error(`Invalid language ${submission.language}`);
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
                .post(formdataFromRecord({ file: new Blob([`${compileCommand}\n${submission.code}`]) }), '/file')
                .json<string>();
        } else {
            const compileResponse = (await sandboxClient
                .post({
                    cmd: [
                        {
                            args: parseArgsStringToArgv(compileCommand).map(e => {
                                if (e === '${input}') return codeFile;
                                if (e === '${output}') return execFile;
                                return e;
                            }),
                            env: [
                                'PATH=/sbin:/bin:/usr/bin:/usr/local/bin:/usr/local/sbin',
                                'LANG=zh_CN.UTF-8',
                            ],
                            files: [
                                { content: '' },
                                { name: 'stdout', max: config.sizeLimit.compileOutput },
                                { name: 'stderr', max: config.sizeLimit.compileOutput },
                            ],
                            procLimit,
                            cpuRateLimit: experiment.cpuLimit,
                            cpuLimit: experiment.compileTimeLimit * 1e6,
                            clockLimit: Math.round(experiment.compileTimeLimit * clockLimitFactor * 1e6),
                            memoryLimit: experiment.compileMemoryLimit,
                            copyIn: {
                                [codeFile]: { content: submission.code },
                            },
                            copyOut: ['stderr'],
                            copyOutCached: [execFile],
                        },
                    ],
                } as GoJudge.Request, '/run')
                .json<GoJudge.Result[]>())[0];
            // dir(compileResponse, { depth: null });
            result.compileSuccess = compileResponse.status === 'Accepted';
            result.compileOutput = compileResponse.files!.stderr;
            if (!result.compileSuccess) {
                result.compileOutput = `Compiler error: ${compileResponse.status}\n${result.compileOutput}`;
                return result;
            }
            execFileId = compileResponse.fileIds![execFile];
        }

        // Judge
        result.result = [];
        const checkpointZip = new StreamZip.async({ file: path.join('storage', experiment.checkpointPath) });
        const checkpointMetadata = yaml.load(await checkpointZip.entryData('metadata.yaml').then(r => r.toString('utf-8'))) as {
            input: string,
            output: string,
            mode: 'text' | 'binary' | 'special-judge',
            note?: string,
        }[];
        // dir(checkpointMetadata, { depth: null });
        for (const checkpoint of checkpointMetadata) {
            const checkpointInput = await checkpointZip.stream(checkpoint.input);
            const checkpointOutputExpected = await checkpointZip.stream(checkpoint.output);
            const checkpointInputFileId = await sandboxClient
                .post(formdataFromRecord({ file: await blobFromReadableStream(checkpointInput) }), '/file')
                .json<string>();
            const runResponse = (await sandboxClient
                .post({
                    cmd: [
                        {
                            args: [execFile],
                            env: [
                                'PATH=/sbin:/bin:/usr/bin:/usr/local/bin:/usr/local/sbin',
                                'LANG=zh_CN.UTF-8',
                            ],
                            files: [
                                { fileId: checkpointInputFileId },
                                { name: 'stdout', max: config.sizeLimit.runOutput },
                                { name: 'stderr', max: stderrLimit },
                            ],
                            procLimit,
                            cpuRateLimit: experiment.cpuLimit,
                            cpuLimit: experiment.runTimeLimit * 1e6,
                            clockLimit: Math.round(experiment.runTimeLimit * clockLimitFactor * 1e6),
                            // 从stdout输出的数据大小也会被计入memoryLimit，输出较长的话会触发MemoryLimitExceeded
                            memoryLimit: experiment.runMemoryLimit + (await checkpointZip.entry(checkpoint.output))!.size,
                            copyIn: {
                                [execFile]: { fileId: execFileId },
                            },
                            copyOutCached: ['stdout', 'stderr'],
                        },
                    ],
                } as GoJudge.Request, '/run')
                .json<GoJudge.Result[]>())[0];
            // dir(runResponse, { depth: null });
            const checkpointOutputFileId = runResponse.fileIds!.stdout;
            const checkpointStderrFileId = runResponse.fileIds!.stderr;
            const checkpointStderr = await sandboxClient.get(`/file/${runResponse.fileIds!.stderr}`).res(r => r.text());
            log('stderr', checkpointStderr);
            if (runResponse.status === 'Accepted') {
                // @ts-expect-error
                const checkpointOutput = await sandboxClient.get(`/file/${checkpointOutputFileId}`).res(r => stream.Readable.fromWeb(r.body!));
                let checkpointOutputLength = 0;
                switch (checkpoint.mode) {
                    case 'binary':
                        log('binary');
                        const hashKey = crypto.randomBytes(32);
                        const hctxExpected = Blake3Hasher.newKeyed(hashKey);
                        const hctxOutput = Blake3Hasher.newKeyed(hashKey);
                        await Promise.all([
                            new Promise(async (resolve, reject) => checkpointOutputExpected
                                .on('data', chunk => hctxExpected.update(chunk))
                                .on('error', err => reject(err))
                                .on('end', resolve)
                            ),
                            new Promise(async (resolve, reject) => checkpointOutput
                                .on('data', chunk => {
                                    hctxOutput.update(chunk);
                                    checkpointOutputLength += chunk.length;
                                })
                                .on('error', err => reject(err))
                                .on('end', resolve)
                            ),
                        ]);
                        const hashExpected = hctxExpected.digestBuffer();
                        const hashOutput = hctxOutput.digestBuffer();
                        log('expected blake3 hash', hashExpected);
                        log('output   blake3 hash', hashOutput);
                        if (hashExpected.compare(hashOutput)) runResponse.status = 'Wrong Answer' as GoJudge.Status;
                        break;
                    case 'text':
                        const checkpointOutputExpectedArray = ((await new Promise((resolve, reject) => {
                            const chunks: Buffer[] = [];
                            checkpointOutputExpected
                                .on('data', chunk => chunks.push(chunk))
                                .on('error', err => reject(err))
                                .on('end', () => resolve(Buffer.concat(chunks)))
                        })) as Buffer).toString('utf-8').trim().split(/\s+/);
                        const checkpointOutputArray = ((await new Promise((resolve, reject) => {
                            const chunks: Buffer[] = [];
                            checkpointOutput
                                .on('data', chunk => {
                                    chunks.push(chunk);
                                    checkpointOutputLength += chunk.length;
                                })
                                .on('error', err => reject(err))
                                .on('end', () => resolve(Buffer.concat(chunks)))
                        })) as Buffer).toString('utf-8').trim().split(/\s+/);
                        log('text');
                        log('expected', checkpointOutputExpectedArray);
                        log('output  ', checkpointOutputArray);
                        if (
                            checkpointOutputExpectedArray.length !== checkpointOutputArray.length
                            || checkpointOutputExpectedArray.some((e, i) => e !== checkpointOutputArray[i])
                        ) runResponse.status = 'Wrong Answer' as GoJudge.Status;
                        break;
                    case 'special-judge':
                        const specialJudgeFile = `special-judge-${crypto.randomUUID()}`;
                        const checkpointInputFile = `input-${crypto.randomUUID()}`;
                        const checkpointOutputFile = `output-${crypto.randomUUID()}`;
                        const specialJudgeFileId = await sandboxClient
                            .post(formdataFromRecord({ file: await blobFromReadableStream(checkpointOutputExpected) }), '/file')
                            .json<string>();
                        const specialJudgeResponse = (await sandboxClient
                            .post({
                                cmd: [
                                    {
                                        args: [specialJudgeFile, checkpointInputFile, checkpointOutputFile],
                                        env: [
                                            'PATH=/sbin:/bin:/usr/bin:/usr/local/bin:/usr/local/sbin',
                                            'LANG=zh_CN.UTF-8',
                                        ],
                                        files: [
                                            { content: '' },
                                            { name: 'stdout', max: config.sizeLimit.runOutput },
                                            { name: 'stderr', max: config.sizeLimit.runOutput },
                                        ],
                                        procLimit,
                                        cpuRateLimit: experiment.cpuLimit,
                                        cpuLimit: experiment.compileTimeLimit * 1e6,
                                        clockLimit: Math.round(experiment.compileTimeLimit * clockLimitFactor * 1e6),
                                        memoryLimit: experiment.compileMemoryLimit,
                                        copyIn: {
                                            [specialJudgeFile]: { fileId: specialJudgeFileId },
                                            [checkpointInputFile]: { fileId: checkpointInputFileId },
                                            [checkpointOutputFile]: { fileId: checkpointOutputFileId },
                                        },
                                    },
                                ],
                            } as GoJudge.Request, '/run')
                            .json<GoJudge.Result[]>())[0];
                        // log('special-judge', specialJudgeResponse);
                        switch (specialJudgeResponse.exitStatus) {
                            case 0:
                                break;
                            case 1:
                                runResponse.status = 'Wrong Answer' as GoJudge.Status;
                                break;
                            default:
                                runResponse.status = 'Internal Error' as GoJudge.Status;
                                break;
                        }
                        await sandboxClient.delete(`/file/${specialJudgeFileId}`).res();
                        break;
                }
                // 减去stdout的部分
                runResponse.memory -= checkpointOutputLength;
            }
            await Promise.all([checkpointInputFileId, checkpointOutputFileId, checkpointStderrFileId].map(e => sandboxClient.delete(`/file/${e}`).res()));
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
        result.acceptedCount = result.result.filter(e => e.status === 'Accepted').length;
        result.accepted = result.acceptedCount === checkpointMetadata.length;
        return result;
    } catch (err) {
        console.log(err);
        return {
            pending: false,
            compileSuccess: false,
            compileOutput: `Sandbox error:\n${(err as Error).stack || err}`,
        };
    }
};

export type JudgeEvent = {
    expid: InferSelectModel<typeof submissions>['expid'],
    subid: InferSelectModel<typeof submissions>['subid'],
    uid: InferSelectModel<typeof submissions>['uid'],
    title: InferSelectModel<typeof experiments>['title'],
    compileSuccess: InferSelectModel<typeof submissions>['compileSuccess'],
    time: InferSelectModel<typeof submissions>['time'],
    memory: InferSelectModel<typeof submissions>['memory'],
    accepted: InferSelectModel<typeof submissions>['accepted'],
    acceptedCount: InferSelectModel<typeof submissions>['acceptedCount'],
};

export type CongratsEvent = {
    expid: InferSelectModel<typeof submissions>['expid'],
    subid: InferSelectModel<typeof submissions>['subid'],
    uid: InferSelectModel<typeof submissions>['uid'],
    title: InferSelectModel<typeof experiments>['title'],
    username: InferSelectModel<typeof users>['username'],
    time: InferSelectModel<typeof submissions>['time'],
    memory: InferSelectModel<typeof submissions>['memory'],
};

export const eventEmitter = new EventEmitter<{
    judge: [JudgeEvent],
    congrats: [CongratsEvent],
}>;

let judgeRightNowResolve: () => void = () => {};

export const judgeRightNow = () => {
    // log('Judge right now! Skip polling.');
    judgeRightNowResolve();
};

export const judgeLoop = async () => {
    while (true) {
        const submission = db
            .select()
            .from(submissions)
            .where(and(
                not(submissions.obsolete),
                submissions.pending,
            ))
            .orderBy(asc(submissions.submitTime))
            .limit(1)
            .get();
        if (!submission) {
            const t = config.sandbox.checkInterval * 1e3;
            // log('No pending submission. Next check:', new Date(Date.now() + t).toISOString());
            await new Promise<void>(resolve => setTimeout(judgeRightNowResolve = resolve, t));
            continue;
        }

        log('Judging submission', submission.subid);
        const result = await judge(submission);
        dir(result, { depth: null });
        db
            .update(submissions)
            .set(result)
            .where(eq(submissions.subid, submission.subid))
            .run();
        const title = db
            .select({
                title: experiments.title,
            })
            .from(experiments)
            .where(eq(experiments.expid, submission.expid))
            .get()!.title;
        eventEmitter.emit('judge', {
            expid: submission.expid,
            subid: submission.subid,
            uid: submission.uid,
            title,
            compileSuccess: result.compileSuccess!,
            time: result.time!,
            memory: result.memory!,
            accepted: result.accepted!,
            acceptedCount: result.acceptedCount!,
        });
        if (result.accepted) {
            const row = db
                .select({
                    subid: submissions.subid,
                })
                .from(submissions)
                .where(and(
                    eq(submissions.expid, submission.expid),
                    eq(submissions.uid, submission.uid),
                    submissions.accepted,
                    not(submissions.obsolete),
                    ne(submissions.subid, submission.subid),
                ))
                .limit(1)
                .get();
            if (!row) {
                const username = db
                    .select({
                        username: users.username,
                    })
                    .from(users)
                    .where(eq(users.uid, submission.uid))
                    .get()!.username;
                eventEmitter.emit('congrats', {
                    expid: submission.expid,
                    subid: submission.subid,
                    uid: submission.uid,
                    title,
                    username,
                    time: result.time!,
                    memory: result.memory!,
                });
            }
        }
    }
};
