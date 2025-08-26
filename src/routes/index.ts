import { Hono } from 'hono';

import adminApiRoutes from './admin.js';
import commonApiRoutes from './common.js';
import experimentApiRoutes from './experiment.js';
import reportApiRoutes from './report.js';

export default new Hono<HonoSchema>()
    .route('/', commonApiRoutes)
    .route('/', adminApiRoutes)
    .route('/', experimentApiRoutes)
    .route('/', reportApiRoutes);
