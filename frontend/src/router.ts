import { createRouter, createWebHashHistory } from 'vue-router';

import store, { tokenPayload } from './store.js';

export default createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            component: () => import(/* vitePrefetch: true */ './pages/home.vue'),
            meta: {
                keepAlive: true,
            },
        },
        {
            path: '/login',
            component: () => import(/* vitePrefetch: true */ './pages/login.vue'),
        },
        {
            path: '/account',
            component: () => import(/* vitePrefetch: true */ './pages/account.vue'),
            beforeEnter: () => {
                if (!store.token) return {
                    path: '/login',
                    replace: true,
                };
            },
        },
        {
            path: '/experiments/:expid(\\d+)',
            component: () => import(/* vitePrefetch: true */ './pages/experiments.vue'),
        },
        {
            path: '/tools/hex2bin',
            component: () => import(/* vitePrefetch: true */ './pages/hex2bin.vue'),
            meta: {
                keepAlive: true,
            },
        },
        {
            path: '/tools/statistics',
            component: () => import(/* vitePrefetch: true */ './pages/statistics.vue'),
            meta: {
                keepAlive: true,
            },
        },
        {
            path: '/admin',
            component: () => import('./pages/admin.vue'),
            beforeEnter: () => {
                if (!store.token || tokenPayload.value?.role !== 'admin') return {
                    path: '/',
                    replace: true,
                };
            },
        },
        {
            path: '/:path(.*)*',
            redirect: '/',
        }
    ],
});
