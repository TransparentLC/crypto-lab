import crypto from 'node:crypto';
import argon2 from '@node-rs/argon2';
import type { Context } from 'hono';
import wretch from 'wretch';
import config from './config';

export const passwordHash = (password: string) =>
    argon2.hash(config.auth.argon2.pepper + password, config.auth.argon2);

export const passwordVerify = (hashed: string, password: string) =>
    argon2.verify(hashed, config.auth.argon2.pepper + password);

export const passwordGenerate = (length: number) =>
    Array(length)
        .fill(0)
        .reduce(
            a =>
                a +
                '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'[
                    Math.floor(Math.random() * 94)
                ],
            '',
        ) as string;

export const formdataFromRecord = (e: Record<string, string | Blob>) =>
    Object.entries(e).reduce((f, [k, v]) => {
        f.set(k, v);
        return f;
    }, new FormData());

// https://bun.com/guides/streams/node-readable-to-blob
export const blobFromReadableStream = async (s: NodeJS.ReadableStream) =>
    // @ts-expect-error
    await new Response(s).blob();

export const turnstileVerify = async (
    ctx: Context,
    captcha: string,
    action: string,
) => {
    const captchaValidation = await wretch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    )
        .post(
            Object.entries({
                secret: config.auth.captcha.secret,
                response: captcha,
                remoteip:
                    ctx.req.header('X-Real-IP') ??
                    ctx.req
                        .header('X-Forwarded-For')
                        ?.split(',')
                        .pop()
                        ?.trim() ??
                    // biome-ignore lint/style/noNonNullAssertion: 必定存在
                    ctx.env.incoming.socket.remoteAddress!,
            }).reduce((acc, cur) => {
                acc.append(cur[0], cur[1]);
                return acc;
            }, new FormData()),
        )
        .json<TurnstileResponse>();
    if (
        captchaValidation.success &&
        captcha !== 'XXXX.DUMMY.TOKEN.XXXX' &&
        captchaValidation.action !== action
    ) {
        captchaValidation.success = false;
        captchaValidation['error-codes'].push('bad-request');
    }
    return captchaValidation;
};

// biome-ignore lint/suspicious/noExplicitAny: reason
export const serializeToken = (payload: any, secret: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
        'aes-128-gcm',
        Buffer.from(secret, 'base64url'),
        iv,
    );
    const payloadBuffer = Buffer.from(JSON.stringify(payload), 'utf-8');
    const token = Buffer.concat([
        iv,
        cipher.update(payloadBuffer),
        cipher.final(),
        cipher.getAuthTag(),
    ]).toString('base64url');
    return token;
};

export const deserializeToken = (token: string, secret: string) => {
    const tokenBuffer = Buffer.from(token, 'base64url');
    const iv = tokenBuffer.subarray(0, 12);
    const decipher = crypto.createDecipheriv(
        'aes-128-gcm',
        Buffer.from(secret, 'base64url'),
        iv,
    );
    decipher.setAuthTag(tokenBuffer.subarray(tokenBuffer.length - 16));
    const payload = JSON.parse(
        Buffer.concat([
            decipher.update(tokenBuffer.subarray(12, tokenBuffer.length - 16)),
            decipher.final(),
        ]).toString('utf-8'),
    );
    return payload;
};
