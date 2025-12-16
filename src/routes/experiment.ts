import path from 'node:path';
import { Blake3Hasher } from '@napi-rs/blake-hash';
import AdmZip from 'adm-zip';
import {
    and,
    asc,
    count,
    desc,
    eq,
    lte,
    min,
    not,
    sql,
    sum,
} from 'drizzle-orm';
import { Hono } from 'hono';
import yaml from 'js-yaml';
import { z } from 'zod';

import config from '../config';
import db from '../database';
import { etag, jwt, jwtOptional, rateLimiter, validator } from '../middlewares';
import { judgeRightNow } from '../sandbox';
import { experiments, reports, submissions, users } from '../schema';

const app = new Hono<HonoSchema>();

app.get('/experiments', etag(), async ctx => {
    const rows = db
        .select({
            expid: experiments.expid,
            title: experiments.title,
        })
        .from(experiments)
        .where(lte(experiments.startTime, new Date().toISOString()))
        .all();
    return ctx.json(rows);
});

app.get('/experiments/:expid{\\d+}', jwtOptional, etag(), async ctx => {
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
        .where(
            and(
                eq(experiments.expid, Number(ctx.req.param('expid'))),
                lte(experiments.startTime, new Date().toISOString()),
            ),
        )
        .get();
    if (!row) return ctx.body(null, 404);
    const extra: {
        checkpointNotes: string[];
        self?: {
            submitted: boolean;
            accepted: boolean;
            report: boolean;
        };
    } = { checkpointNotes: [] };
    const checkpointZip = new AdmZip(path.join('storage', row.checkpointPath));
    // @ts-expect-error
    delete row.checkpointPath;
    const checkpointMetadata = yaml.load(
        await new Promise((resolve, reject) =>
            checkpointZip.readAsTextAsync('metadata.yaml', (data, err) =>
                err ? reject(err) : resolve(data),
            ),
        ),
    ) as {
        input: string;
        output: string;
        mode: 'text' | 'binary' | 'special-judge';
        note?: string;
    }[];
    extra.checkpointNotes = checkpointMetadata.map(e => e.note || '');
    if (ctx.get('jwtPayload')) {
        const selfSubmissionRow = db
            .select({ result: submissions.result })
            .from(submissions)
            .where(
                and(
                    not(submissions.obsolete),
                    eq(submissions.expid, Number(ctx.req.param('expid'))),
                    eq(submissions.uid, ctx.get('jwtPayload').uid),
                ),
            )
            .orderBy(desc(submissions.submitTime))
            .limit(1)
            .get();
        const selfSubmissionAcceptedRow = selfSubmissionRow
            ? db
                  .select({ result: submissions.result })
                  .from(submissions)
                  .where(
                      and(
                          not(submissions.obsolete),
                          eq(submissions.expid, Number(ctx.req.param('expid'))),
                          eq(submissions.uid, ctx.get('jwtPayload').uid),
                          submissions.accepted,
                      ),
                  )
                  .orderBy(desc(submissions.submitTime))
                  .limit(1)
                  .get()
            : undefined;
        const selfReportRow = db
            .select({ reportPath: reports.reportPath })
            .from(reports)
            .where(
                and(
                    eq(reports.expid, Number(ctx.req.param('expid'))),
                    eq(reports.uid, ctx.get('jwtPayload').uid),
                ),
            )
            .get();
        extra.self = {
            submitted: Boolean(selfSubmissionRow),
            accepted: Boolean(selfSubmissionAcceptedRow),
            report: Boolean(selfReportRow),
        };
    }
    return ctx.json({ ...row, ...extra });
});

const recentSubmissionHashes = new Set<string>();

app.post(
    '/experiments/:expid{\\d+}/submissions',
    jwt,
    validator(
        'json',
        z.object({
            code: z.string().min(0).max(config.sizeLimit.code),
            language: z.string().min(0).max(16).toLowerCase(),
        }),
    ),
    rateLimiter({
        windowMs: config.rateLimit.code.window * 1e3,
        limit: config.rateLimit.code.limit,
        keyGenerator: ctx => `code-${ctx.get('jwtPayload').uid}`,
    }),
    async ctx => {
        const body = ctx.req.valid('json');
        const now = new Date();
        const experimentRow = db
            .select({
                endTime: experiments.endTime,
                compileCommands: experiments.compileCommands,
            })
            .from(experiments)
            .where(
                and(
                    eq(experiments.expid, Number(ctx.req.param('expid'))),
                    lte(experiments.startTime, now.toISOString()),
                ),
            )
            .get();
        if (!experimentRow) return ctx.body(null, 404);
        if (
            !config.allowLateSubmission &&
            new Date(experimentRow.endTime) < now
        )
            return ctx.json({ error: '实验已截止' }, 400);
        if (!Object.keys(experimentRow.compileCommands).includes(body.language))
            return ctx.json(
                { error: '提交的代码不是实验允许使用的编程语言' },
                400,
            );
        if (
            db
                .select({ count: count() })
                .from(submissions)
                .where(
                    and(
                        eq(submissions.uid, ctx.get('jwtPayload').uid),
                        eq(submissions.expid, Number(ctx.req.param('expid'))),
                        submissions.pending,
                    ),
                )
                .get()?.count
        )
            return ctx.json(
                {
                    error: '你已经提交过代码了，请等待之前的代码评测完成后再提交',
                },
                400,
            );
        const hctx = new Blake3Hasher();
        hctx.update(
            `${ctx.get('jwtPayload').uid}#${ctx.req.param('expid')}#${body.language}#`,
        );
        hctx.update(body.code);
        const codeHash = hctx.digestBuffer().toString('base64url');
        if (recentSubmissionHashes.has(codeHash)) {
            return ctx.json({ error: '你已经提交过相同的代码了' }, 400);
        } else {
            recentSubmissionHashes.add(codeHash);
            setTimeout(
                () => recentSubmissionHashes.delete(codeHash),
                86400 * 1000,
            );
        }
        db.insert(submissions)
            .values({
                uid: ctx.get('jwtPayload').uid,
                expid: Number(ctx.req.param('expid')),
                code: body.code,
                language: body.language,
            })
            .run();
        judgeRightNow();
        return ctx.body(null, 204);
    },
);

app.get(
    '/experiments/:expid{\\d+}/submissions',
    jwtOptional,
    validator(
        'query',
        z.object({
            page: z.coerce.number().int().min(1).optional().default(1),
            self: z.stringbool().optional().default(false),
            accepted: z.stringbool().optional().default(false),
        }),
    ),
    etag(),
    async ctx => {
        const query = ctx.req.valid('query');
        // biome-ignore lint/style/noNonNullAssertion: count 必定存在
        // biome-ignore lint/suspicious/noExtraNonNullAssertion: count 必定存在
        const rowCount = db
            .select({ count: count() })
            .from(submissions)
            .where(
                and(
                    not(submissions.obsolete),
                    eq(submissions.expid, Number(ctx.req.param('expid'))),
                    ...(ctx.get('jwtPayload') && query.self
                        ? [eq(submissions.uid, ctx.get('jwtPayload').uid)]
                        : []),
                    ...(query.accepted ? [submissions.accepted] : []),
                ),
            )
            .get()!.count!;
        const subqueryUsername = db
            .select({
                uid: users.uid,
                username: users.username,
            })
            .from(users)
            .as('subqueryUsername');
        const rows = db
            .select({
                subid: submissions.subid,
                uid: submissions.uid,
                username: subqueryUsername.username,
                submitTime: submissions.submitTime,
                pending: submissions.pending,
                code: submissions.code,
                language: submissions.language,
                length: sql`length(${submissions.code})`,
                compileSuccess: submissions.compileSuccess,
                compileOutput: submissions.compileOutput,
                time: submissions.time,
                memory: submissions.memory,
                accepted: submissions.accepted,
                acceptedCount: submissions.acceptedCount,
                result: submissions.result,
            })
            .from(submissions)
            .where(
                and(
                    not(submissions.obsolete),
                    eq(submissions.expid, Number(ctx.req.param('expid'))),
                    ...(ctx.get('jwtPayload') && query.self
                        ? [eq(submissions.uid, ctx.get('jwtPayload').uid)]
                        : []),
                    ...(query.accepted ? [submissions.accepted] : []),
                ),
            )
            .innerJoin(
                subqueryUsername,
                eq(submissions.uid, subqueryUsername.uid),
            )
            .orderBy(desc(submissions.submitTime))
            .limit(20)
            .offset((query.page - 1) * 20)
            .all();
        if (!ctx.get('jwtPayload') || ctx.get('jwtPayload').role !== 'admin') {
            rows.forEach(row => {
                if (row.uid !== ctx.get('jwtPayload')?.uid) {
                    // @ts-expect-error
                    row.code = row.compileOutput = null;
                    row.result?.forEach(e => {
                        e.stderr = '';
                    });
                }
            });
        }

        const special: {
            gold?: (typeof rows)[number];
            silver?: (typeof rows)[number];
            bronze?: (typeof rows)[number];
        } = {};

        const subqueryBestAccepted = db
            .select({
                subid: submissions.subid,
                time: min(submissions.time),
            })
            .from(submissions)
            .where(
                and(
                    not(submissions.obsolete),
                    eq(submissions.expid, Number(ctx.req.param('expid'))),
                    submissions.accepted,
                ),
            )
            .groupBy(submissions.uid)
            .as('subqueryBestAccepted');
        const rowsBestAccepted = db
            .select({
                subid: submissions.subid,
                uid: submissions.uid,
                username: subqueryUsername.username,
                submitTime: submissions.submitTime,
                pending: submissions.pending,
                code: submissions.code,
                language: submissions.language,
                length: sql`length(${submissions.code})`,
                compileSuccess: submissions.compileSuccess,
                compileOutput: submissions.compileOutput,
                time: submissions.time,
                memory: submissions.memory,
                accepted: submissions.accepted,
                acceptedCount: submissions.acceptedCount,
                result: submissions.result,
            })
            .from(submissions)
            .innerJoin(
                subqueryBestAccepted,
                eq(submissions.subid, subqueryBestAccepted.subid),
            )
            .innerJoin(
                subqueryUsername,
                eq(submissions.uid, subqueryUsername.uid),
            )
            .orderBy(asc(submissions.time))
            .limit(3)
            .all();
        if (!ctx.get('jwtPayload') || ctx.get('jwtPayload').role !== 'admin') {
            rowsBestAccepted.forEach(row => {
                if (row.uid !== ctx.get('jwtPayload')?.uid)
                    // @ts-expect-error
                    row.code = row.compileOutput = null;
            });
        }
        special.gold = rowsBestAccepted[0];
        special.silver = rowsBestAccepted[1];
        special.bronze = rowsBestAccepted[2];

        const statistic: {
            count: number;
            accepted: number;
            averageTime: number;
            averageMemory: number;
            averageLength: number;
            language: Record<
                string,
                {
                    count: number;
                    accepted: number;
                    averageTime: number;
                    averageMemory: number;
                    averageLength: number;
                }
            >;
        } = Object.assign(
            // biome-ignore lint/style/noNonNullAssertion: explanation
            db
                .select({
                    count: count(),
                })
                .from(submissions)
                .where(
                    and(
                        not(submissions.obsolete),
                        eq(submissions.expid, Number(ctx.req.param('expid'))),
                    ),
                )
                .get()!,
            // biome-ignore lint/style/noNonNullAssertion: explanation
            db
                .select({
                    accepted: count(),
                    averageTime:
                        sql`ifnull(avg(${submissions.time}), 0)`.mapWith(
                            Number,
                        ),
                    averageMemory:
                        sql`ifnull(avg(${submissions.memory}), 0)`.mapWith(
                            Number,
                        ),
                    averageLength:
                        sql`ifnull(avg(length(${submissions.code})), 0)`.mapWith(
                            Number,
                        ),
                })
                .from(submissions)
                .where(
                    and(
                        not(submissions.obsolete),
                        eq(submissions.expid, Number(ctx.req.param('expid'))),
                        submissions.accepted,
                    ),
                )
                .get()!,
            {
                language: Object.fromEntries(
                    db
                        .select({
                            language: submissions.language,
                            count: count(),
                            accepted: sum(
                                sql`case when ${submissions.accepted} then 1 else 0 end`,
                            ).mapWith(Number),
                            averageTime:
                                sql`ifnull(avg(case when ${submissions.accepted} then ${submissions.time} else ${null} end), 0)`.mapWith(
                                    Number,
                                ),
                            averageMemory:
                                sql`ifnull(avg(case when ${submissions.accepted} then ${submissions.memory} else ${null} end), 0)`.mapWith(
                                    Number,
                                ),
                            averageLength:
                                sql`ifnull(avg(case when ${submissions.accepted} then length(${submissions.code}) else ${null} end), 0)`.mapWith(
                                    Number,
                                ),
                        })
                        .from(submissions)
                        .where(
                            and(
                                not(submissions.obsolete),
                                eq(
                                    submissions.expid,
                                    Number(ctx.req.param('expid')),
                                ),
                            ),
                        )
                        .groupBy(submissions.language)
                        .all()
                        .map(
                            ({
                                language,
                                count,
                                accepted,
                                averageTime,
                                averageMemory,
                                averageLength,
                            }) => [
                                language,
                                {
                                    count,
                                    accepted,
                                    averageTime,
                                    averageMemory,
                                    averageLength,
                                },
                            ],
                        ),
                ),
            },
        );

        return ctx.json({
            count: rowCount,
            pages: Math.ceil(rowCount / 20),
            rows,
            special,
            statistic,
        });
    },
);

export default app;
