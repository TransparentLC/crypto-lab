import fs from 'node:fs';
import yaml from 'js-yaml';

type Config = {
    server: {
        host: string,
        port: number,
    },
    auth: {
        captcha: {
            site: string,
            secret: string,
        },
        argon2: {
            pepper: string,
            memoryCost: number,
            timeCost: number,
            parallelism: number,
        },
        jwt: {
            secret: string,
            expire: number,
            refresh: number,
        },
        admin: string,
        passwordReset: {
            secret: string,
            expire: number,
        },
    },
    sizeLimit: {
        compileOutput: number,
        runOutput: number,
        code: number,
        report: number,
    },
    rateLimit: {
        code: {
            window: number,
            limit: number,
        },
        report: {
            window: number,
            limit: number,
        },
    },
    sandbox: {
        endpoint: string,
        token: string,
        checkInterval: number,
    },
};

const deepFreeze = <T extends object>(obj: T) => {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        const value = (obj as any)[prop];
        if (value && typeof value === 'object') {
            deepFreeze(value);
        }
    }
    return Object.freeze(obj);
};

export default deepFreeze(yaml.load(fs.readFileSync('config.yaml', { encoding: 'utf-8' })) as Config);
