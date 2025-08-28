import { Hono } from 'hono';

import adminApiRoutes from './admin';
import commonApiRoutes from './common';
import experimentApiRoutes from './experiment';
import reportApiRoutes from './report';

export default new Hono<HonoSchema>()
    .route('/', commonApiRoutes)
    .route('/', adminApiRoutes)
    .route('/', experimentApiRoutes)
    .route('/', reportApiRoutes);
