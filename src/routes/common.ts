import { and, count, eq, gte, not, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import config from '../config';
import db from '../database';
import transporter from '../mail-transporter';
import { etag, jwt, validator } from '../middlewares';
import { type CongratsEvent, eventEmitter, type JudgeEvent } from '../sandbox';
import { submissions, users } from '../schema';
import {
    deserializeToken,
    passwordGenerate,
    passwordHash,
    passwordVerify,
    serializeToken,
    turnstileVerify,
} from '../util';

const app = new Hono<HonoSchema>();

app.get('/refresh-token', jwt, async ctx =>
    ctx.json({
        token: await sign(
            {
                ...ctx.get('jwtPayload'),
                exp: Math.floor(Date.now() / 1000) + config.auth.jwt.expire,
            },
            config.auth.jwt.secret,
        ),
    }),
);

app.get('/site-config', async ctx =>
    ctx.json({
        captchaSiteKey: config.auth.captcha.site,
        tokenRefresh: config.auth.jwt.refresh,
        sizeLimit: config.sizeLimit,
        emailRegistrationDomainWhitelist:
            config.auth.emailRegistration.domainWhitelist,
        passwordResetCooldown: config.auth.passwordReset.cooldown,
        theme: config.theme,
        allowLateSubmission: config.allowLateSubmission,
    }),
);

app.post(
    '/login',
    validator(
        'json',
        z.object({
            username: z.string().min(1),
            password: z.string().min(1).max(64),
            captcha: z.string().min(1),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        try {
            const captchaValidation = await turnstileVerify(
                ctx,
                body.captcha,
                'crypto-lab-login',
            );
            if (!captchaValidation.success)
                return ctx.json(
                    {
                        error: `人机验证失败：${captchaValidation['error-codes'].join(', ')}`,
                    },
                    400,
                );
        } catch (err) {
            console.log(err);
            return ctx.json({ error: `人机验证服务端验证失败：${err}` }, 500);
        }
        const user =
            body.username === 'admin'
                ? ({
                      uid: 0,
                      username: 'admin',
                      password: config.auth.admin,
                      enabled: true,
                  } as typeof users.$inferSelect)
                : db
                      .select()
                      .from(users)
                      .where(eq(users.username, body.username))
                      .get();
        if (!user || !(await passwordVerify(user.password, body.password))) {
            if (!user) await passwordHash('');
            return ctx.json({ error: '用户名或密码错误' }, 400);
        }
        if (!user.enabled) return ctx.json({ error: '该用户未启用' }, 400);
        return ctx.json({
            token: await sign(
                {
                    uid: user.uid,
                    username: user.username,
                    role: user.uid === 0 ? 'admin' : 'user',
                    exp: Math.floor(Date.now() / 1000) + config.auth.jwt.expire,
                },
                config.auth.jwt.secret,
            ),
        });
    },
);

app.post(
    '/register',
    validator(
        'json',
        z.object({
            token: z.string().min(1),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        let payload: RegisterPayload;
        try {
            payload = deserializeToken(
                body.token,
                config.auth.emailRegistration.secret,
            );
        } catch {
            return ctx.json({ error: '注册令牌无效' }, 400);
        }
        if (Date.now() > payload.exp)
            return ctx.json({ error: '注册令牌已过期' }, 400);
        if (payload.username === 'admin')
            return ctx.json({ error: '“admin”是管理员用户名，不能注册' }, 400);
        const row = db
            .select({
                uid: users.uid,
            })
            .from(users)
            .where(
                or(
                    eq(users.username, payload.username),
                    eq(users.email, payload.email),
                ),
            )
            .get();
        if (row)
            return ctx.json({ error: '这个用户名或邮箱已经被注册过了' }, 400);
        const password = passwordGenerate(16);
        const uid = db
            .insert(users)
            .values({
                username: payload.username,
                password: await passwordHash(password),
                email: payload.email,
                passwordResetTime: new Date().toISOString(),
            })
            .run().lastInsertRowid;
        return ctx.json({
            uid,
            username: payload.username,
            password,
        });
    },
);

app.post(
    '/change-password',
    jwt,
    validator(
        'json',
        z.object({
            oldPassword: z.string().min(1).max(64),
            newPassword: z.string().min(1).max(64),
        }),
    ),
    async ctx => {
        if (ctx.get('jwtPayload').role === 'admin')
            return ctx.json({ error: '请管理员通过配置文件修改密码' }, 400);
        const body = ctx.req.valid('json');
        const row = db
            .select({ password: users.password })
            .from(users)
            .where(eq(users.uid, ctx.get('jwtPayload').uid))
            .get();
        if (!row) return ctx.json({ error: '用户不存在' }, 400);
        if (!(await passwordVerify(row.password, body.oldPassword)))
            return ctx.json({ error: '旧密码错误' }, 400);
        db.update(users)
            .set({ password: await passwordHash(body.newPassword) })
            .where(eq(users.uid, ctx.get('jwtPayload').uid))
            .run();
        return ctx.body(null, 204);
    },
);

app.post(
    '/reset-password',
    validator(
        'json',
        z.object({
            token: z.string().min(1),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        let payload: ResetPasswordPayload;
        try {
            payload = deserializeToken(
                body.token,
                config.auth.passwordReset.secret,
            );
        } catch {
            return ctx.json({ error: '重设密码令牌无效' }, 400);
        }
        if (Date.now() > payload.exp)
            return ctx.json({ error: '重设密码令牌已过期' }, 400);
        const row = db
            .select({
                username: users.username,
                password: users.password,
            })
            .from(users)
            .where(eq(users.uid, payload.uid))
            .get();
        if (!row) return ctx.json({ error: '重设密码令牌无效' }, 400);
        if (row.password !== payload.password)
            return ctx.json(
                { error: '该用户已重设密码，此前生成的令牌已作废' },
                400,
            );
        const password = passwordGenerate(16);
        db.update(users)
            .set({
                password: await passwordHash(password),
                passwordResetTime: new Date(
                    Date.now() + config.auth.passwordReset.cooldown * 1e3,
                ).toISOString(),
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

app.post(
    '/register-token',
    validator(
        'json',
        z.object({
            username: z.string().min(1),
            email: z.email(),
            captcha: z.string().min(1),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        try {
            const captchaValidation = await turnstileVerify(
                ctx,
                body.captcha,
                'crypto-lab-register-token',
            );
            if (!captchaValidation.success)
                return ctx.json(
                    {
                        error: `人机验证失败：${captchaValidation['error-codes'].join(', ')}`,
                    },
                    400,
                );
        } catch (err) {
            console.log(err);
            return ctx.json({ error: `人机验证服务端验证失败：${err}` }, 500);
        }
        if (
            !config.auth.emailRegistration.domainWhitelist.includes(
                // biome-ignore lint/style/noNonNullAssertion: reason
                body.email.split('@').pop()!.toLowerCase(),
            )
        ) {
            return ctx.json({ error: '用于注册的邮箱地址不在白名单内' }, 400);
        }
        const row = db
            .select({
                uid: users.uid,
            })
            .from(users)
            .where(
                or(
                    eq(users.username, body.username),
                    eq(users.email, body.email),
                ),
            )
            .get();
        if (row)
            return ctx.json({ error: '这个用户名或邮箱已经被注册过了' }, 400);
        const expire = Date.now() + config.auth.emailRegistration.expire * 1e3;
        const token = serializeToken(
            {
                username: body.username,
                email: body.email,
                exp: expire,
            } as RegisterPayload,
            config.auth.emailRegistration.secret,
        );
        await transporter.sendMail({
            from: `Crypto Lab <${config.mail.username}>`,
            to: body.email,
            subject: '[现代密码学实验] 注册令牌',
            html: `<p>你的注册令牌是：</p><pre style="white-space:pre-wrap;word-break:break-all"><code>${token}</code></pre><p>在登录界面选择“注册”，输入令牌即可完成注册。</p><p>令牌可以在 ${new Date(expire).toISOString()} 前使用一次。</p>`,
        });
        return ctx.body(null, 204);
    },
);

app.post(
    '/password-reset-token',
    validator(
        'json',
        z.object({
            username: z.string().min(1),
            email: z.email(),
            captcha: z.string().min(1),
        }),
    ),
    async ctx => {
        const body = ctx.req.valid('json');
        try {
            const captchaValidation = await turnstileVerify(
                ctx,
                body.captcha,
                'crypto-lab-password-reset-token',
            );
            if (!captchaValidation.success)
                return ctx.json(
                    {
                        error: `人机验证失败：${captchaValidation['error-codes'].join(', ')}`,
                    },
                    400,
                );
        } catch (err) {
            console.log(err);
            return ctx.json({ error: `人机验证服务端验证失败：${err}` }, 500);
        }
        const row = db
            .select({
                uid: users.uid,
                password: users.password,
                passwordResetTime: users.passwordResetTime,
            })
            .from(users)
            .where(
                and(
                    eq(users.username, body.username),
                    eq(users.email, body.email),
                ),
            )
            .get();
        if (!row) return ctx.json({ error: '用户不存在' }, 400);
        if (Date.now() < new Date(row.passwordResetTime).getTime()) {
            return ctx.json(
                {
                    error: `重设密码的冷却时间还没有结束，请在 ${new Date(row.passwordResetTime).toISOString()} 后重试`,
                },
                400,
            );
        }
        const expire = Date.now() + config.auth.passwordReset.expire * 1e3;
        const token = serializeToken(
            {
                ...row,
                exp: expire,
            } as ResetPasswordPayload,
            config.auth.passwordReset.secret,
        );
        await transporter.sendMail({
            from: `Crypto Lab <${config.mail.username}>`,
            to: body.email,
            subject: '[现代密码学实验] 重设密码令牌',
            html: `<p>你的重设密码令牌是：</p><pre style="white-space:pre-wrap;word-break:break-all"><code>${token}</code></pre><p>在登录界面选择“忘记密码”，输入令牌即可重设密码。</p><p>令牌可以在 ${new Date(expire).toISOString()} 前使用一次，使用后之前生成的令牌将会作废。</p>`,
        });
        return ctx.body(null, 204);
    },
);

app.get(
    '/notification',
    async (ctx, next) => {
        try {
            const token = ctx.req.query('token');
            if (!token) throw new Error();
            ctx.set(
                'jwtPayload',
                await verify(token, config.auth.jwt.secret, { alg: 'HS256' }),
            );
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
    ctx =>
        streamSSE(
            ctx,
            async stream =>
                new Promise(resolve => {
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
                    const t = setTimeout(
                        () => {
                            stream
                                .writeSSE({
                                    event: 'abort',
                                    data: '',
                                })
                                .then(() => stream.abort());
                        },
                        // biome-ignore lint/style/noNonNullAssertion: 必定存在
                        ctx.get('jwtPayload').exp! * 1000 - Date.now(),
                    );
                    stream.onAbort(() => {
                        eventEmitter.removeListener('judge', judgeListener);
                        eventEmitter.removeListener(
                            'congrats',
                            congratsListener,
                        );
                        clearTimeout(t);
                        clearInterval(p);
                        resolve();
                    });
                }),
        ),
);

app.get('/statistics', etag(), async ctx => {
    const before = new Date(Date.now() + 3600 * 1000);
    before.setMinutes(0, 0, 0);
    const after = new Date(before.getTime() - 86400 * 7 * 1000);
    const subquery = db
        .select({
            hour: sql<string>`substr(${submissions.submitTime}, 0, length('YYYY-mm:ddTHH') + 1)`.as(
                'hour',
            ),
            compileSuccess: submissions.compileSuccess,
            accepted: submissions.accepted,
        })
        .from(submissions)
        .where(
            and(
                not(submissions.obsolete),
                gte(submissions.submitTime, after.toISOString()),
            ),
        )
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
});

export default app;
