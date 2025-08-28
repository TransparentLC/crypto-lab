import readline from 'node:readline';
import { passwordHash, passwordVerify } from '../src/util';

let password = process.argv[2];
if (!password) {
    const rl = readline.promises.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    password = await rl.question('Password: ');
    rl.close();
}

const hash = await passwordHash(password);
console.log(hash);

const ts = performance.now();
await passwordVerify(hash, password);
const te = performance.now();
console.log('Verified in', te - ts, 'ms');
