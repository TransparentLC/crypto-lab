import argon2 from '@node-rs/argon2';

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
