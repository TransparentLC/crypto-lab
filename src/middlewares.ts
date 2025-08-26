import { zValidator } from '@hono/zod-validator';
import type { MiddlewareHandler } from 'hono';
import { jwt as honoJwt, verify } from 'hono/jwt';
import { rateLimiter as honoRateLimiter } from 'hono-rate-limiter';
import { fromError } from 'zod-validation-error';

import config from './config.js';

export const logger: MiddlewareHandler = async (ctx, next) => {
    const startTime = performance.now();

    await next();

    const statusCode = ctx.res.status;
    const statusString = process.env.NO_COLOR
        ? statusCode.toString()
        : `\x1b[${[39, 94, 92, 96, 93, 91, 95][(statusCode / 100) | 0]}m${statusCode}\x1b[0m`;
    const remoteAddress =
        ctx.req.header('X-Real-IP') ??
        ctx.req.header('X-Forwarded-For')?.split(',').pop()?.trim() ??
        ctx.env.incoming.socket.remoteAddress;
    console.log(
        new Date().toISOString(),
        '-',
        remoteAddress,
        ctx.req.method,
        ctx.req.path,
        statusString,
        `${(performance.now() - startTime).toFixed(2)}ms`,
    );
};

export const jwt = honoJwt({ secret: config.auth.jwt.secret });

export const jwtQuery: MiddlewareHandler = async (ctx, next) => {
    if (!ctx.get('jwtPayload')) {
        const token = ctx.req.query('token');
        if (!token)
            return ctx.json(
                { error: 'no authorization included in request' },
                403,
            );
        try {
            ctx.set('jwtPayload', await verify(token, config.auth.jwt.secret));
        } catch {
            return ctx.json({ error: 'Unauthorized' }, 403);
        }
    }
    await next();
};

export const jwtOptional: MiddlewareHandler = async (ctx, next) =>
    await (ctx.req.header('Authorization') ? jwt(ctx, next) : next());

export const ensureAdmin: MiddlewareHandler = async (ctx, next) => {
    if (ctx.get('jwtPayload').role !== 'admin')
        return ctx.json({ error: '仅管理员可以操作' }, 403);
    await next();
};

export const validator: typeof zValidator = (target, schema, hook) =>
    // @ts-expect-error
    zValidator(
        target,
        schema,
        hook ||
            ((result, ctx) => {
                if (!result.success)
                    return ctx.json(
                        { error: fromError(result.error).toString() },
                        400,
                    );
            }),
    );

export const rateLimiter: typeof honoRateLimiter = config =>
    honoRateLimiter({
        standardHeaders: 'draft-7',
        message: { error: 'Too many requests, please try again later.' },
        ...config,
    });
