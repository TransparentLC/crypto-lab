import hljs from 'highlight.js/lib/core';
import hljsC from 'highlight.js/lib/languages/c';
import hljsCpp from 'highlight.js/lib/languages/cpp';
import hljsJavascript from 'highlight.js/lib/languages/javascript';
import hljsMarkdown from 'highlight.js/lib/languages/markdown';
import hljsPlaintext from 'highlight.js/lib/languages/plaintext';
import hljsPython from 'highlight.js/lib/languages/python';
import hljsRust from 'highlight.js/lib/languages/rust';
import { createApp } from 'vue';

import app from './app.vue';
import http, { type ApiSiteConfig } from './request';
import router from './router';
import store from './store';

store.siteConfig = await http.get('/site-config').json<ApiSiteConfig>();

hljs.registerLanguage('javascript', hljsJavascript);
hljs.registerLanguage('markdown', hljsMarkdown);
hljs.registerLanguage('python', hljsPython);
hljs.registerLanguage('c', hljsC);
hljs.registerLanguage('cpp', hljsCpp);
hljs.registerLanguage('rust', hljsRust);
hljs.registerLanguage('plain', hljsPlaintext);
hljs.registerLanguage('text', hljsPlaintext);
hljs.registerLanguage('plaintext', hljsPlaintext);

createApp(app).use(router).mount('#app');

const consoleBadge = (label: string, content: string, color: string) =>
    console.log(
        `%c ${label} %c ${content} `,
        'color:#fff;background-color:#555;border-radius:3px 0 0 3px',
        `color:#fff;background-color:${color};border-radius:0 3px 3px 0`,
    );

consoleBadge('Project', 'crypto-lab', '#07c');
consoleBadge('Author', 'TransparentLC', '#f84');
// @ts-expect-error
consoleBadge('Build Time', __BUILD_TIME__, '#f48');
// @ts-expect-error
consoleBadge('Build With', `${__VUE_VERSION__} + ${__VITE_VERSION__}`, '#4b8');
