import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream';
import AdmZip from 'adm-zip';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { and, asc, count, desc, eq, not, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import yaml from 'js-yaml';
import StreamZip from 'node-stream-zip';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import config from '../config';
import db from '../database';
import { ensureAdmin, etag, jwt, jwtQuery, validator } from '../middlewares';
import { judgeRightNow } from '../sandbox';
import { experiments, reports, submissions, users } from '../schema';
import { passwordGenerate, passwordHash } from '../util';

const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: 465,
    secure: true,
    pool: true,
    auth: {
        user: config.mail.username,
        pass: config.mail.password,
    },
});

const app = new Hono<HonoSchema>();

app.get(
    '/admin/users',
    jwt,
    ensureAdmin,
    etag(),
    validator(
        'query',
        z.object({
            page: z.coerce.number().int().min(1).optional().default(1),
        }),
    ),
    async ctx => {
        const query = ctx.req.valid('query');
        // biome-ignore lint/style/noNonNullAssertion: count 必定存在
        const rowCount = db.select({ count: count() }).from(users).get()
            ?.count!;
        const rows = db
            .select({
                uid: users.uid,
                username: users.username,
                enabled: users.enabled,
            })
            .from(users)
            .limit(20)
            .offset((query.page - 1) * 20)
            .all();
        return ctx.json({
            count: rowCount,
            pages: Math.ceil(rowCount / 20),
            rows,
        });
    },
);

app.post(
    '/admin/users',
    jwt,
    ensureAdmin,
    validator(
        'json',
        z.object({
            username: z.string().min(1),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        const password = passwordGenerate(16);
        db.insert(users)
            .values({
                username: body.username,
                password: await passwordHash(password),
            })
            .run();
        return ctx.json({ password });
    },
);

app.patch(
    '/admin/users/:uid{\\d+}',
    jwt,
    ensureAdmin,
    validator(
        'json',
        z.object({
            username: z.string().min(1).optional(),
            enabled: z.boolean().optional(),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        db.update(users)
            .set(body)
            .where(eq(users.uid, Number(ctx.req.param('uid'))))
            .run();
        return ctx.body(null, 204);
    },
);

app.post(
    '/admin/users/:uid{\\d+}/password-reset-token',
    jwt,
    ensureAdmin,
    validator(
        'json',
        z
            .object({
                email: z.nullable(z.email().optional()),
            })
            .optional(),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        const row = db
            .select({
                uid: users.uid,
                password: users.password,
            })
            .from(users)
            .where(eq(users.uid, Number(ctx.req.param('uid'))))
            .get();
        if (!row) return ctx.json({ error: '用户不存在' }, 400);
        const iv = crypto.getRandomValues(Buffer.allocUnsafe(16));
        const expire = Date.now() + config.auth.passwordReset.expire * 1e3;
        const cipher = crypto.createCipheriv(
            'aes-128-ctr',
            Buffer.from(config.auth.passwordReset.secret, 'base64url'),
            iv,
        );
        const payload = Buffer.from(
            JSON.stringify({
                ...row,
                exp: expire,
            } as ResetPasswordPayload),
            'utf-8',
        );
        const token = Buffer.concat([iv, cipher.update(payload)]).toString(
            'base64url',
        );
        if (body?.email) {
            await transporter.sendMail({
                from: `Crypto Lab <${config.mail.username}>`,
                to: body.email,
                subject: '[现代密码学实验] 重设密码令牌',
                html: `<p>你的重设密码令牌是：</p><pre style="white-space:pre-wrap;word-break:break-all"><code>${token}</code></pre><p>在登录界面选择“忘记密码”，输入令牌即可重设密码。</p><p>令牌可以在 ${new Date(expire).toISOString()} 前使用一次，使用后之前生成的令牌将会作废。</p>`,
            });
        }
        return ctx.json({
            token,
            expire: new Date(expire).toISOString(),
        });
    },
);

app.post('/admin/experiments', jwt, ensureAdmin, async ctx => {
    db.insert(experiments)
        .values({
            title: '实验标题',
            description: '实验介绍',
            cpuLimit: 1000,
            compileTimeLimit: 1000,
            compileMemoryLimit: 1048576 * 64,
            runTimeLimit: 5000,
            runMemoryLimit: 1048576 * 32,
            startTime: '2106-02-07T06:28:15.000Z',
            endTime: '2106-02-07T06:28:15.000Z',
            // biome-ignore-start lint/suspicious/noTemplateCurlyInString: 占位用，并不是 JS 的模板字符串
            compileCommands: {
                c: 'gcc -Wall -Wextra -Ofast -march=native -mtune=native -std=c23 -DONLINE_JUDGE -o ${output} ${input}',
                cpp: 'g++ -Wall -Wextra -Ofast -march=native -mtune=native -std=c++20 -DONLINE_JUDGE -o ${output} ${input}',
            },
            // biome-ignore-end lint/suspicious/noTemplateCurlyInString: 占位用，并不是 JS 的模板字符串
            checkpointPath: '',
        })
        .run();
    return ctx.body(null, 204);
});

app.get('/admin/experiments', jwt, ensureAdmin, etag(), async ctx => {
    const rows = db
        .select({
            expid: experiments.expid,
            title: experiments.title,
        })
        .from(experiments)
        .all();
    return ctx.json(rows);
});

app.get(
    '/admin/experiments/:expid{\\d+}',
    jwt,
    ensureAdmin,
    etag(),
    async ctx => {
        const row = db
            .select({
                title: experiments.title,
                description: experiments.description,
                reportSubmission: experiments.reportSubmission,
                cpuLimit: experiments.cpuLimit,
                compileTimeLimit: experiments.compileTimeLimit,
                compileMemoryLimit: experiments.compileMemoryLimit,
                runTimeLimit: experiments.runTimeLimit,
                runMemoryLimit: experiments.runMemoryLimit,
                startTime: experiments.startTime,
                endTime: experiments.endTime,
                compileCommands: experiments.compileCommands,
                checkpointPath: experiments.checkpointPath,
            })
            .from(experiments)
            .where(eq(experiments.expid, Number(ctx.req.param('expid'))))
            .get();
        if (!row) return ctx.body(null, 404);
        return ctx.json(row);
    },
);

app.patch(
    '/admin/experiments/:expid{\\d+}',
    jwt,
    ensureAdmin,
    validator(
        'json',
        z.object({
            title: z.string().min(1),
            description: z.string(),
            reportSubmission: z.boolean(),
            cpuLimit: z.number().int().min(1),
            compileTimeLimit: z.number().int().min(1),
            compileMemoryLimit: z.number().int().min(1),
            runTimeLimit: z.number().int().min(1),
            runMemoryLimit: z.number().int().min(1),
            startTime: z.string().datetime(),
            endTime: z.string().datetime(),
            compileCommands: z.record(z.string(), z.string()),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        db.update(experiments)
            .set(body)
            .where(eq(experiments.expid, Number(ctx.req.param('expid'))))
            .run();
        return ctx.body(null, 204);
    },
);

app.post(
    '/admin/experiments/:expid{\\d+}/checkpoint',
    jwt,
    ensureAdmin,
    validator(
        'form',
        z.object({
            file: z
                .instanceof(File)
                .refine(e => path.extname(e.name.toLowerCase()) === '.zip'),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('form');
        const filename = crypto.randomUUID();
        // biome-ignore lint/style/noNonNullAssertion: checkpointPath 必定存在
        const filenameOld = db
            .select({ checkpointPath: experiments.checkpointPath })
            .from(experiments)
            .where(eq(experiments.expid, Number(ctx.req.param('expid'))))
            .get()?.checkpointPath!;
        await stream.promises.pipeline(
            body.file.stream(),
            fs.createWriteStream(path.join('storage', filename)),
        );
        db.update(experiments)
            .set({ checkpointPath: filename })
            .where(eq(experiments.expid, Number(ctx.req.param('expid'))))
            .run();
        await fs.promises
            .unlink(path.join('storage', filenameOld))
            .catch(() => {});
        return ctx.body(null, 204);
    },
);

app.get(
    '/admin/experiments/:expid{\\d+}/submissions',
    jwtQuery,
    ensureAdmin,
    etag(),
    async ctx => {
        const experiment = db
            .select({
                checkpointPath: experiments.checkpointPath,
            })
            .from(experiments)
            .where(eq(experiments.expid, Number(ctx.req.param('expid'))))
            .get();
        if (!experiment) return ctx.body(null, 404);
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

        const selects = {
            subid: submissions.subid,
            expid: submissions.expid,
            uid: submissions.uid,
            username: users.username,
            submitTime: submissions.submitTime,
            language: submissions.language,
            time: sql`IFNULL(${submissions.time}, 1e999)`,
            memory: sql`IFNULL(${submissions.memory}, 1e999)`,
            accepted: submissions.accepted,
            acceptedCount: submissions.acceptedCount,
            acceptedPercentage: sql`${submissions.acceptedCount} / ${checkpointMetadata.length}`,
            code: submissions.code,
        };
        const zip = new AdmZip();
        // biome-ignore lint/suspicious/noExplicitAny: 写入 CSV 的每一行，懒得管类型了
        const rows: any[][] = [Object.keys(selects).filter(e => e !== 'code')];
        db.selectDistinct({ uid: submissions.uid })
            .from(submissions)
            .where(
                and(
                    not(submissions.obsolete),
                    not(submissions.pending),
                    eq(submissions.expid, Number(ctx.req.param('expid'))),
                ),
            )
            .all()
            .forEach(({ uid }) => {
                // biome-ignore lint/style/noNonNullAssertion: 必定存在
                const row = db
                    .select(selects)
                    .from(submissions)
                    .where(
                        and(
                            not(submissions.obsolete),
                            not(submissions.pending),
                            eq(
                                submissions.expid,
                                Number(ctx.req.param('expid')),
                            ),
                            eq(submissions.uid, uid),
                        ),
                    )
                    .innerJoin(users, eq(submissions.uid, users.uid))
                    .orderBy(
                        desc(submissions.acceptedCount),
                        asc(submissions.time),
                        asc(submissions.memory),
                    )
                    .limit(1)
                    .get()!;
                zip.addFile(
                    path.join(
                        'code',
                        `submission${row.subid}-exp${ctx.req.param('expid')}-uid${row.uid}.${row.language}`,
                    ),
                    Buffer.from(row.code),
                );
                // @ts-expect-error
                delete row.code;
                rows.push(Object.values(row));
            });
        zip.addFile('result.csv', Buffer.from(csvStringify(rows)));
        ctx.header('Content-Type', 'application/zip');
        return ctx.body(
            stream.Readable.toWeb(
                stream.Readable.from(await zip.toBufferPromise()),
            ) as ReadableStream,
        );
    },
);

app.get(
    '/admin/experiments/:expid{\\d+}/reports',
    jwtQuery,
    ensureAdmin,
    etag(),
    async ctx => {
        const subquery = db
            .select({
                uid: users.uid,
                username: users.username,
            })
            .from(users)
            .as('subquery');
        const rows = db
            .select({
                reportid: reports.reportid,
                reportPath: reports.reportPath,
                uid: reports.uid,
                username: subquery.username,
            })
            .from(reports)
            .where(eq(reports.expid, Number(ctx.req.param('expid'))))
            .innerJoin(subquery, eq(reports.uid, subquery.uid))
            .all();
        const zip = new AdmZip();
        rows.forEach(e => {
            zip.addLocalFile(
                path.join('storage', e.reportPath),
                '',
                `report${e.reportid}-exp${ctx.req.param('expid')}-uid${e.uid}-${e.username}.pdf`,
            );
        });
        ctx.header('Content-Type', 'application/zip');
        return ctx.body(
            stream.Readable.toWeb(
                stream.Readable.from(await zip.toBufferPromise()),
            ) as ReadableStream,
        );
    },
);

app.post(
    '/admin/experiments/:expid{\\d+}/obsolete-rejudge',
    jwt,
    ensureAdmin,
    async ctx => {
        db.update(submissions)
            .set({ obsolete: true })
            .where(eq(submissions.expid, Number(ctx.req.param('expid'))))
            .run();
        db.selectDistinct({ uid: submissions.uid })
            .from(submissions)
            .where(
                and(
                    submissions.obsolete,
                    eq(submissions.expid, Number(ctx.req.param('expid'))),
                ),
            )
            .all()
            .forEach(({ uid }) => {
                // biome-ignore lint/style/noNonNullAssertion: 必定存在
                const { subid } = db
                    .select({ subid: submissions.subid })
                    .from(submissions)
                    .where(
                        and(
                            submissions.obsolete,
                            eq(
                                submissions.expid,
                                Number(ctx.req.param('expid')),
                            ),
                            eq(submissions.uid, uid),
                        ),
                    )
                    .orderBy(desc(submissions.submitTime))
                    .limit(1)
                    .get()!;
                db.update(submissions)
                    .set({
                        pending: true,
                        obsolete: false,
                        compileSuccess: null,
                        compileOutput: null,
                        time: null,
                        memory: null,
                        accepted: null,
                        acceptedCount: null,
                        result: null,
                    })
                    .where(eq(submissions.subid, subid))
                    .run();
            });
        judgeRightNow();
        return ctx.body(null, 204);
    },
);

app.post(
    '/admin/submissions/:subid{\\d+}/rejudge',
    jwt,
    ensureAdmin,
    async ctx => {
        db.update(submissions)
            .set({
                pending: true,
                compileSuccess: null,
                compileOutput: null,
                time: null,
                memory: null,
                accepted: null,
                acceptedCount: null,
                result: null,
            })
            .where(eq(submissions.subid, Number(ctx.req.param('subid'))))
            .run();
        judgeRightNow();
        return ctx.body(null, 204);
    },
);

export default app;
