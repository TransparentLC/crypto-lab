import fs from 'node:fs';
import { Hono } from 'hono';
import { type HTTPResponseError } from 'hono/types';
import { type StatusCode } from 'hono/utils/http-status';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import config from './config.js';
import { logger } from './middlewares.js';
import { judgeLoop } from './sandbox.js';

import commonApiRoutes from './routes/common.js';
import adminApiRoutes from './routes/admin.js';
import experimentApiRoutes from './routes/experiment.js';
import reportApiRoutes from './routes/report.js';

if (!fs.existsSync('storage')) fs.mkdirSync('storage');

const app = new Hono<HonoSchema>;

app
    .use(logger)
    .onError((err, ctx) => {
        let statusCode: StatusCode = (err as HTTPResponseError).getResponse?.().status as StatusCode;
        if (!statusCode) {
            statusCode = 500;
            console.error(err);
        }
        return ctx.json({ error: err.message }, statusCode);
    })
    .route('/api/', commonApiRoutes)
    .route('/api/', adminApiRoutes)
    .route('/api/', experimentApiRoutes)
    .route('/api/', reportApiRoutes)
    .use(serveStatic({ root: './public' }));

if (typeof config.server.port === 'string' && fs.existsSync(config.server.port)) {
    fs.unlinkSync(config.server.port);
}

serve({
    fetch: app.fetch,
    hostname: config.server.host,
    port: config.server.port,
});

if (typeof config.server.port === 'string') {
    fs.chmodSync(config.server.port, 666);
}

console.log(`Server is running on ${config.server.host}:${config.server.port}`);

judgeLoop();
