import crypto from 'node:crypto';
import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { streamSSE } from 'hono/streaming';
import wretch from 'wretch';
import { z } from 'zod';
import { and, count, gte, eq, not, sql } from 'drizzle-orm';

import config from '../config.js';
import db from '../database.js';
import { users, submissions } from '../schema.js';
import { validator, jwt } from '../middlewares.js';
import { passwordHash, passwordVerify, passwordGenerate } from '../util.js';
import { eventEmitter, type JudgeEvent, type CongratsEvent } from '../sandbox.js';

const app = new Hono<HonoSchema>;

app.get(
    '/refresh-token',
    jwt,
    async ctx => ctx.json({
        token: await sign({
            ...ctx.get('jwtPayload'),
            exp: Math.floor(Date.now() / 1000) + config.auth.jwt.expire,
        }, config.auth.jwt.secret),
    }),
);

app.get(
    '/site-config',
    async ctx => ctx.json({
        captchaSiteKey: config.auth.captcha.site,
        tokenRefresh: config.auth.jwt.refresh,
        sizeLimit: config.sizeLimit,
    }),
);

app.post(
    '/login',
    validator('json', z.object({
        username: z.string().min(1),
        password: z.string().min(1).max(64),
        captcha: z.string().min(1),
    })),
    async ctx => {
        const body = ctx.req.valid('json');
        try {
            const captchaValidation = await wretch('https://challenges.cloudflare.com/turnstile/v0/siteverify')
                .post(Object.entries({
                    secret: config.auth.captcha.secret,
                    response: body.captcha,
                    remoteip: ctx.req.header('X-Real-IP')
                        ?? ctx.req.header('X-Forwarded-For')?.split(',').pop()?.trim()
                        ?? ctx.env.incoming.socket.remoteAddress!,
                }).reduce((acc, cur) => { acc.append(cur[0], cur[1]); return acc; }, new FormData))
                .json<TurnstileResponse>();
            if (
                !captchaValidation.success
                || (body.captcha !== 'XXXX.DUMMY.TOKEN.XXXX' && captchaValidation.action !== 'crypto-lab-login')
            ) return ctx.json({ error: `人机验证失败：${captchaValidation['error-codes'].join(', ')}` }, 400);
        } catch (err) {
            console.log(err);
            return ctx.json({ error: `人机验证服务端验证失败：${err}` }, 500);
        }
        const user = body.username === 'admin'
            ? ({
                uid: 0,
                username: 'admin',
                password: config.auth.admin,
                enabled: true,
            }) as typeof users.$inferSelect
            : db.select().from(users).where(eq(users.username, body.username)).get();
        if (!user || !(await passwordVerify(user.password, body.password))) {
            if (!user) await passwordHash('');
            return ctx.json({ error: '用户名或密码错误' }, 400);
        }
        if (!user.enabled) return ctx.json({ error: '该用户未启用' }, 400);
        return ctx.json({
            token: await sign({
                uid: user.uid,
                username: user.username,
                role: user.uid === 0 ? 'admin' : 'user',
                exp: Math.floor(Date.now() / 1000) + config.auth.jwt.expire,
            }, config.auth.jwt.secret),
        });
    },
);

app.post(
    '/change-password',
    jwt,
    validator('json', z.object({
        oldPassword: z.string().min(1).max(64),
        newPassword: z.string().min(1).max(64),
    })),
    async ctx => {
        if (ctx.get('jwtPayload').role === 'admin') return ctx.json({ error: '请管理员通过配置文件修改密码' }, 400);
        const body = ctx.req.valid('json');
        const row = db
            .select({ password: users.password })
            .from(users)
            .where(eq(users.uid, ctx.get('jwtPayload').uid))
            .get();
        if (!row) return ctx.json({ error: '用户不存在' }, 400);
        if (!(await passwordVerify(row.password, body.oldPassword))) return ctx.json({ error: '旧密码错误' }, 400);
        db
            .update(users)
            .set({ password: await passwordHash(body.newPassword) })
            .where(eq(users.uid, ctx.get('jwtPayload').uid))
            .run();
        return ctx.body(null, 204);
    },
);

app.post(
    '/reset-password',
    validator('json', z.object({
        token: z.string().min(1),
        captcha: z.string().min(1),
    })),
    async ctx => {
        const body = ctx.req.valid('json');
        try {
            const captchaValidation = await wretch('https://challenges.cloudflare.com/turnstile/v0/siteverify')
                .post(Object.entries({
                    secret: config.auth.captcha.secret,
                    response: body.captcha,
                    remoteip: ctx.req.header('X-Real-IP')
                        ?? ctx.req.header('X-Forwarded-For')?.split(',').pop()?.trim()
                        ?? ctx.env.incoming.socket.remoteAddress!,
                }).reduce((acc, cur) => { acc.append(cur[0], cur[1]); return acc; }, new FormData))
                .json<TurnstileResponse>();
            if (
                !captchaValidation.success
                || (body.captcha !== 'XXXX.DUMMY.TOKEN.XXXX' && captchaValidation.action !== 'crypto-lab-reset-password')
            ) return ctx.json({ error: `人机验证失败：${captchaValidation['error-codes'].join(', ')}` }, 400);
        } catch (err) {
            console.log(err);
            return ctx.json({ error: `人机验证服务端验证失败：${err}` }, 500);
        }
        const token = Buffer.from(body.token, 'base64url');
        const iv = token.subarray(0, 16);
        let payload: ResetPasswordPayload;
        try {
            const decipher = crypto.createDecipheriv('aes-128-ctr', Buffer.from(config.auth.passwordReset.secret, 'base64url'), iv);
            payload = JSON.parse(Buffer.from(decipher.update(token.subarray(16))).toString('utf-8'));
        } catch {
            return ctx.json({ error: '重设密码令牌无效' }, 400);
        }
        if (Date.now() > payload.exp) return ctx.json({ error: '重设密码令牌已过期' }, 400);
        const row = db
            .select({
                username: users.username,
                password: users.password,
            })
            .from(users)
            .where(eq(users.uid, payload.uid))
            .get();
        if (!row) return ctx.json({ error: '重设密码令牌无效' }, 400);
        if (row.password !== payload.password) return ctx.json({ error: '该用户已重设密码，此前生成的令牌已作废' }, 400);
        const password = passwordGenerate(16);
        db
            .update(users)
            .set({
                password: await passwordHash(password),
            })
            .where(eq(users.uid, payload.uid))
            .run();
        return ctx.json({
            uid: payload.uid,
            username: row.username,
            password,
        });
    },
);

app.get(
    '/notification',
    async (ctx, next) => {
        try {
            const token = ctx.req.query('token');
            if (!token) throw new Error;
            ctx.set('jwtPayload', await verify(token, config.auth.jwt.secret));
        } catch {
            return streamSSE(ctx, async stream => {
                await stream.writeSSE({
                    event: 'abort',
                    data: '',
                });
            });
        }
        await next();
    },
    ctx => streamSSE(ctx, async stream => new Promise(resolve => {
        ctx.header('X-Accel-Buffering', 'no');

        const judgeListener = (e: JudgeEvent) => {
            if (e.uid !== ctx.get('jwtPayload').uid) return;
            stream.writeSSE({
                event: 'judge',
                data: JSON.stringify(e),
            });
        };
        const congratsListener = (e: CongratsEvent) => {
            stream.writeSSE({
                event: 'congrats',
                data: JSON.stringify(e),
            });
        };
        eventEmitter.addListener('judge', judgeListener);
        eventEmitter.addListener('congrats', congratsListener);
        const p = setInterval(() => stream.write(':\n\n'), 55555);
        const t = setTimeout(() => {
            stream.writeSSE({
                event: 'abort',
                data: '',
            }).then(() => stream.abort());
        }, ctx.get('jwtPayload').exp! * 1000 - Date.now());
        stream.onAbort(() => {
            eventEmitter.removeListener('judge', judgeListener);
            eventEmitter.removeListener('congrats', congratsListener);
            clearTimeout(t);
            clearInterval(p);
            resolve();
        });
    })),
);

app.get(
    '/statistics',
    async ctx => {
        const before = new Date(Date.now() + 3600 * 1000);
        before.setMinutes(0, 0, 0);
        const after = new Date(before.getTime() - 86400 * 7 * 1000);
        const subquery = db
            .select({
                hour: sql<string>`substr(${submissions.submitTime}, 0, length('YYYY-mm:ddTHH') + 1)`.as('hour'),
                compileSuccess: submissions.compileSuccess,
                accepted: submissions.accepted,
            })
            .from(submissions)
            .where(and(
                not(submissions.obsolete),
                gte(submissions.submitTime, after.toISOString()),
            ))
            .as('subquery');
        const rows = db
            .select({
                time: sql<string>`concat(${subquery.hour}, ':00:00.000Z')`,
                submission: count(),
                compiled: count(sql`iif(${subquery.compileSuccess}, 1, NULL)`),
                accepted: count(sql`iif(${subquery.accepted}, 1, NULL)`),
            })
            .from(subquery)
            .groupBy(sql`${subquery.hour}`)
            .all();
        const rowsPadded: typeof rows = [];
        let d = after;
        rows.forEach(e => {
            const t = new Date(e.time);
            for (let i = d.getTime(); i < t.getTime(); i += 3600 * 1000) {
                rowsPadded.push({
                    time: new Date(i).toISOString(),
                    submission: 0,
                    compiled: 0,
                    accepted: 0,
                });
            }
            rowsPadded.push(e);
            d = new Date(new Date(e.time).getTime() + 3600 * 1000);
        });
        for (let i = d.getTime(); i < before.getTime(); i += 3600 * 1000) {
            rowsPadded.push({
                time: new Date(i).toISOString(),
                submission: 0,
                compiled: 0,
                accepted: 0,
            });
        }
        return ctx.json(rowsPadded);
    },
);

export default app;
