import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { HTTPResponseError } from 'hono/types';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import config from './config';
import { logger } from './middlewares';
import apiRoutes from './routes';
import { judgeLoop } from './sandbox';

if (!fs.existsSync('storage')) fs.mkdirSync('storage');

const app = new Hono<HonoSchema>();

app.use(logger)
    .onError((err, ctx) => {
        let statusCode = (err as HTTPResponseError).getResponse?.()
            .status as ContentfulStatusCode;
        if (!statusCode) {
            statusCode = 500;
            console.error(err);
        }
        return ctx.json({ error: err.message }, statusCode);
    })
    .route('/api', apiRoutes)
    .use(serveStatic({ root: './public' }));

if (
    typeof config.server.port === 'string' &&
    fs.existsSync(config.server.port)
) {
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
