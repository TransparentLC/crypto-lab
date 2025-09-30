import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream';
import { and, eq, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import config from '../config';
import db from '../database';
import {
    etag,
    jwt,
    jwtOptional,
    jwtQuery,
    rateLimiter,
    validator,
} from '../middlewares';
import { experiments, reports } from '../schema';

const app = new Hono<HonoSchema>();

app.post(
    '/experiments/:expid{\\d+}/reports',
    jwt,
    validator(
        'form',
        z.object({
            file: z
                .instanceof(File)
                .refine(
                    e =>
                        path.extname(e.name.toLowerCase()) === '.pdf' &&
                        e.size < config.sizeLimit.report,
                ),
        }),
    ),
    rateLimiter({
        windowMs: config.rateLimit.report.window * 1e3,
        limit: config.rateLimit.report.limit,
        keyGenerator: ctx => `report-${ctx.get('jwtPayload').uid}`,
    }),
    async ctx => {
        const body = ctx.req.valid('form');
        const now = new Date();
        const experimentRow = db
            .select({
                endTime: experiments.endTime,
            })
            .from(experiments)
            .where(
                and(
                    eq(experiments.expid, Number(ctx.req.param('expid'))),
                    lte(experiments.startTime, now.toISOString()),
                ),
            )
            .get();
        if (!experimentRow) return ctx.json(null, 404);
        if (
            !config.allowLateSubmission &&
            new Date(experimentRow.endTime) < now
        )
            return ctx.json({ error: '实验已截止' }, 400);

        const filename = crypto.randomUUID();
        await stream.promises.pipeline(
            body.file.stream(),
            fs.createWriteStream(path.join('storage', filename)),
        );

        const reportRow = db
            .select()
            .from(reports)
            .where(
                and(
                    eq(reports.expid, Number(ctx.req.param('expid'))),
                    eq(reports.uid, ctx.get('jwtPayload').uid),
                ),
            )
            .get();
        if (reportRow) {
            await fs.promises.unlink(
                path.join('storage', reportRow.reportPath),
            );
            db.update(reports)
                .set({ reportPath: filename })
                .where(eq(reports.reportid, reportRow.reportid))
                .run();
        } else {
            db.insert(reports)
                .values({
                    expid: Number(ctx.req.param('expid')),
                    uid: ctx.get('jwtPayload').uid,
                    reportPath: filename,
                })
                .run();
        }
        return ctx.body(null, 204);
    },
);

app.get(
    '/experiments/:expid{\\d+}/reports',
    jwtOptional,
    jwtQuery,
    etag(),
    async ctx => {
        const row = db
            .select({ reportPath: reports.reportPath })
            .from(reports)
            .where(
                and(
                    eq(reports.expid, Number(ctx.req.param('expid'))),
                    eq(reports.uid, ctx.get('jwtPayload').uid),
                ),
            )
            .get();
        if (!row) return ctx.body(null, 404);
        ctx.header('Content-Type', 'application/pdf');
        return ctx.body(
            stream.Readable.toWeb(
                fs.createReadStream(path.join('storage', row.reportPath)),
            ) as ReadableStream,
        );
    },
);

export default app;
