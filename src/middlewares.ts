import { zValidator } from '@hono/zod-validator';
import { xxh3 } from '@node-rs/xxhash';
import type { MiddlewareHandler } from 'hono';
import { etag as honoEtag } from 'hono/etag';
import { jwt as honoJwt, verify } from 'hono/jwt';
import {
    rateLimiter as honoRateLimiter,
    type RateLimitInfo,
} from 'hono-rate-limiter';
import { fromError } from 'zod-validation-error';

import config from './config';

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

export const jwt = honoJwt({ secret: config.auth.jwt.secret, alg: 'HS256' });

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
        // @ts-expect-error
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
    // @ts-expect-error
    honoRateLimiter<{ Variables: { rateLimit: RateLimitInfo } }>({
        standardHeaders: 'draft-7',
        // @ts-expect-error
        message: ctx => {
            // https://honohub.dev/docs/rate-limiter/configuration#context-properties
            const { resetTime } = ctx.get('rateLimit');
            // biome-ignore lint/style/noNonNullAssertion: explanation
            const after = Math.ceil((resetTime!.getTime() - Date.now()) / 1000);
            return {
                error: `Too many requests, please try again later after ${after < 60 ? `${after} seconds` : `${Math.round(after / 60)} minutes`}.`,
            };
        },
        ...config,
    });

export const etag: typeof honoEtag = (options = {}) =>
    honoEtag({
        generateDigest: body => {
            const h = xxh3.xxh128(body, 0x0d00072100114514n);
            const r = new Uint8Array(16);
            const dv = new DataView(r.buffer);
            dv.setBigUint64(8, h);
            dv.setBigUint64(0, h >> 64n);
            return r.buffer;
        },
        ...options,
    });
