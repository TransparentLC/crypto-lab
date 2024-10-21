import { createApp } from 'vue';
import { createDiscreteApi } from 'naive-ui';

import hljs from 'highlight.js/lib/core';
import hljsJavascript from 'highlight.js/lib/languages/javascript';
import hljsMarkdown from 'highlight.js/lib/languages/markdown';
import hljsPython from 'highlight.js/lib/languages/python';
import hljsC from 'highlight.js/lib/languages/c';
import hljsCpp from 'highlight.js/lib/languages/cpp';
import hljsRust from 'highlight.js/lib/languages/rust';
import hljsPlaintext from 'highlight.js/lib/languages/plaintext';

import app from './app.vue';
import router from './router.js';
import http, { type ApiSiteConfig } from './request.js';
import store from './store.js';

await http.get('/site-config').json<ApiSiteConfig>(r => store.siteConfig = r);

hljs.registerLanguage('javascript', hljsJavascript);
hljs.registerLanguage('markdown', hljsMarkdown);
hljs.registerLanguage('python', hljsPython);
hljs.registerLanguage('c', hljsC);
hljs.registerLanguage('cpp', hljsCpp);
hljs.registerLanguage('rust', hljsRust);
hljs.registerLanguage('plain', hljsPlaintext);
hljs.registerLanguage('text', hljsPlaintext);
hljs.registerLanguage('plaintext', hljsPlaintext);

window.chiya = {
    ...createDiscreteApi(['message', 'dialog', 'notification'], {
        notificationProviderProps: {
            placement: 'bottom-right',
        },
    }),
    route: () => {},
};

createApp(app)
    .use(router)
    .mount('#app');

const consoleBadge = (label: string, content: string, color: string) => console.log(
    `%c ${label} %c ${content} `,
    'color:#fff;background-color:#555;border-radius:3px 0 0 3px',
    `color:#fff;background-color:${color};border-radius:0 3px 3px 0`
);

consoleBadge('Project', 'crypto-lab', '#07c');
consoleBadge('Author', 'TransparentLC', '#f84');
// @ts-ignore
consoleBadge('Build Time', __BUILD_TIME__, '#f48');
// @ts-ignore
consoleBadge('Build With', `${__VUE_VERSION__} + ${__VITE_VERSION__}`, '#4b8');
