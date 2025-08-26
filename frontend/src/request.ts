import wretch from 'wretch';
import wretchQueryStringAddon from 'wretch/addons/queryString';
import store, { tokenValidity } from './store.js';

export default wretch('api')
    .addon(wretchQueryStringAddon)
    .middlewares([
        next => (url, opts) => {
            if (store.token) {
                // console.log('Token validity:', tokenValidity.value, 'Refresh if under:', store.siteConfig.tokenRefresh);
                // biome-ignore lint/style/noNonNullAssertion: token 存在则 tokenValidity 必定存在
                if (tokenValidity.value! > 0) {
                    opts = {
                        ...opts,
                        headers: {
                            ...(opts.headers || {}),
                            Authorization: `Bearer ${store.token}`,
                        },
                    };
                    // biome-ignore lint/style/noNonNullAssertion: token 存在则 tokenValidity 必定存在
                    if (tokenValidity.value! < store.siteConfig.tokenRefresh) {
                        // console.log('Refresh token');
                        wretch('/api/refresh-token')
                            .auth(`Bearer ${store.token}`)
                            .get()
                            .json<ApiRefreshToken>()
                            .then(({ token }) => {
                                store.token = token;
                                localStorage.setItem('token', token);
                            });
                    }
                } else {
                    localStorage.removeItem('token');
                    store.token = '';
                    if (window.chiya) {
                        const route = window.chiya.getCurrentRoute();
                        window.chiya.route({
                            path: '/login',
                            query: route ? { redirect: route.path } : undefined,
                        });
                        window.chiya.message.warning('登录已过期');
                        throw new Error('登录已过期');
                    }
                }
            }
            return next(url, opts);
        },
    ])
    .catcher(401, err => {
        window.chiya.message.error('登录状态无效');
        localStorage.removeItem('token');
        store.token = '';
        const route = window.chiya.getCurrentRoute();
        window.chiya.route({
            path: '/login',
            query: route ? { redirect: route.path } : undefined,
        });
        throw err;
    })
    .catcherFallback(err => {
        (window.chiya?.message.error || alert)(
            err.json?.error ||
                err.message ||
                `HTTP ${err.status} error on ${err.url}`,
        );
        throw err;
    });

export type ApiRefreshToken = {
    token: string;
};

export type ApiLogin = {
    token: string;
};

export type ApiResetPassword = {
    uid: number;
    username: string;
    password: string;
};

export type ApiSiteConfig = {
    captchaSiteKey: string;
    tokenRefresh: number;
    sizeLimit: {
        code: number;
        report: number;
    };
    theme: {
        color: {
            primary: string;
            hover: string;
            pressed: string;
            suppl: string;
        };
        logo: string;
    };
};

export type ApiAdminUsers = {
    count: number;
    pages: number;
    rows: {
        uid: number;
        username: string;
        enabled: boolean;
    }[];
};

export type ApiAdminUserCreate = {
    password: string;
};

export type ApiAdminUserPasswordResetToken = {
    token: string;
    expire: string;
};

export type ApiExperimentList = {
    expid: number;
    title: string;
}[];

export type ApiExperiment = {
    title: string;
    description: string;
    reportSubmission: boolean;
    cpuLimit: number;
    compileTimeLimit: number;
    compileMemoryLimit: number;
    runTimeLimit: number;
    runMemoryLimit: number;
    startTime: string;
    endTime: string;
    compileCommands: Record<string, string>;
    checkpointNotes: string[];
    self?: {
        submitted: boolean;
        accepted: boolean;
        report: boolean;
    };
};

export type ApiAdminExperiment = {
    title: string;
    description: string;
    reportSubmission: boolean;
    cpuLimit: number;
    compileTimeLimit: number;
    compileMemoryLimit: number;
    runTimeLimit: number;
    runMemoryLimit: number;
    startTime: string;
    endTime: string;
    compileCommands: Record<string, string>;
    checkpointPath: string;
};

type ApiExperimentSubmissionsRow = {
    subid: number;
    uid: number;
    username: string;
    submitTime: string;
    pending: boolean;
    language: string;
    code: string | null;
    length: number;
    compileSuccess: boolean | null;
    compileOutput: string | null;
    time: number | null;
    memory: number | null;
    accepted: boolean | null;
    acceptedCount: number | null;
    result:
        | {
              time: number;
              memory: number;
              status:
                  | 'Accepted'
                  | 'Wrong Answer'
                  | 'Memory Limit Exceeded'
                  | 'Time Limit Exceeded'
                  | 'Output Limit Exceeded'
                  | 'File Error'
                  | 'Nonzero Exit Status'
                  | 'Signalled'
                  | 'Internal Error';
              stderr: string;
          }[]
        | null;
};

export type ApiExperimentSubmissions = {
    count: number;
    pages: number;
    rows: ApiExperimentSubmissionsRow[];
    special: {
        gold?: ApiExperimentSubmissionsRow;
        silver?: ApiExperimentSubmissionsRow;
        bronze?: ApiExperimentSubmissionsRow;
    };
};

export type ApiStatistics = {
    time: string;
    submission: number;
    compiled: number;
    accepted: number;
}[];
