import crypto from 'node:crypto';
import argon2 from '@node-rs/argon2';

for (const memoryCost of [8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152]) {
    for (const timeCost of [1, 2, 3, 4, 5]) {
        for (const parallelism of [1]) {
            const config: argon2.Options = {
                memoryCost,
                timeCost,
                parallelism,
            };
            const password = crypto.randomUUID();
            const hashed = await argon2.hash(password, config);
            const ts = performance.now();
            await argon2.verify(hashed, password);
            const te = performance.now();
            console.log(config, 'Verified in', te - ts, 'ms');
        }
    }
}