import argon2 from '@node-rs/argon2';

import config from './config.js';

export const passwordHash = (password: string) => argon2.hash(config.auth.argon2.pepper + password, config.auth.argon2);

export const passwordVerify = (hashed: string, password: string) => argon2.verify(hashed, config.auth.argon2.pepper + password);

export const passwordGenerate = (length: number) => Array(length)
    .fill(0)
    .reduce(a => a += '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'[Math.floor(Math.random() * 94)], '') as string;

export const formdataFromRecord = (e: Record<string, string | Blob>) => Object.entries(e).reduce((f, [k, v]) => { f.set(k, v); return f; }, new FormData);

// https://stackoverflow.com/questions/75793118/streaming-multipart-form-data-request-with-native-fetch-in-node-js
export const blobFromReadableStream = (s: NodeJS.ReadableStream) => ({
    [Symbol.toStringTag]: 'File',
    name: 'file',
    stream: () => s,
} as unknown as Blob);
