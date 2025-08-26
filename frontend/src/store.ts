import { mdiPartyPopper } from '@mdi/js';
import { type JwtPayload, jwtDecode } from 'jwt-decode';
import { NAvatar, NButton, NTime } from 'naive-ui';
import ReconnectingEventSource from 'reconnecting-eventsource';
import { computed, h, reactive, watch } from 'vue';

import NMdi from './components/mdi.vue';
import formatSize from './format-size.js';

const store = reactive({
    token: localStorage.getItem('token') || '',
    experiments: [] as { expid: number; title: string }[],
    siteConfig: {
        captchaSiteKey: '',
        tokenRefresh: 0,
        sizeLimit: {
            code: 0,
            report: 0,
        },
        theme: {
            color: {
                primary: '',
                hover: '',
                pressed: '',
                suppl: '',
            },
            logo: '',
        },
    },
});

export const tokenPayload = computed(() =>
    store.token
        ? jwtDecode<
              JwtPayload & {
                  uid: number;
                  username: string;
                  role: 'admin' | 'user';
              }
          >(store.token)
        : null,
);

export const tokenValidity = computed(() =>
    // biome-ignore lint/style/noNonNullAssertion: exp 必定存在
    store.token ? tokenPayload.value?.exp! - Date.now() / 1000 : null,
);

let notificationSSE: ReconnectingEventSource;

watch(
    () => store.token,
    () => {
        // biome-ignore lint/style/noNonNullAssertion: token 存在则 exp 必定存在
        if (!store.token || tokenValidity.value! <= 0) {
            if (notificationSSE) notificationSSE.close();
            return;
        }
        notificationSSE = new ReconnectingEventSource(
            `/api/notification?token=${encodeURIComponent(store.token)}`,
            {
                max_retry_time: 5000,
            },
        );
        notificationSSE.addEventListener('abort', () =>
            notificationSSE.close(),
        );
        notificationSSE.addEventListener('judge', e => {
            const data: {
                expid: number;
                subid: number;
                uid: number;
                title: string;
                compileSuccess: boolean;
                time: number | null;
                memory: number | null;
                accepted: boolean | null;
                acceptedCount: number | null;
            } = JSON.parse(e.data);
            let content = `你在“${data.title}”的提交 #${data.subid} 已经完成评测了。\n`;
            if (data.compileSuccess) {
                if (data.accepted) {
                    content += '通过了全部的测试用例！🎉\n';
                } else {
                    content += `通过了 ${data.acceptedCount} 个测试用例。\n`;
                }
                // biome-ignore lint/style/noNonNullAssertion: 只要 compileSuccess 的话 memory 就一定存在
                content += `（最大用时 ${data.time} ms，最大内存占用 ${formatSize(data.memory!)}）`;
            } else {
                content += '编译失败了，请查看编译输出以获取详细信息。';
            }
            const n = window.chiya.notification[
                data.compileSuccess
                    ? data.accepted
                        ? 'success'
                        : 'warning'
                    : 'error'
            ]({
                title: '评测完成',
                content,
                meta: () => h(NTime, { time: new Date() }),
                action: () =>
                    h(
                        NButton,
                        {
                            onClick: () => {
                                window.chiya.route(
                                    `/experiments/${data.expid}`,
                                );
                                n.destroy();
                            },
                            text: true,
                        },
                        () => '查看实验',
                    ),
            });
        });
        notificationSSE.addEventListener('congrats', e => {
            const data: {
                expid: number;
                subid: number;
                uid: number;
                title: string;
                username: string;
                time: number;
                memory: number;
            } = JSON.parse(e.data);
            const n = window.chiya.notification.info({
                title: '喜报',
                content: `用户 ${data.username} 第一次 AC 了“${data.title}”！🎉\n（最大用时 ${data.time} ms，最大内存占用 ${formatSize(data.memory)}）`,
                avatar: () =>
                    h(
                        NAvatar,
                        {
                            size: 'small',
                            round: true,
                            style: { backgroundColor: '#8a2be2' },
                        },
                        () =>
                            h(NMdi, {
                                icon: mdiPartyPopper,
                                color: '#fff',
                                size: '1.2em',
                            }),
                    ),
                meta: () => h(NTime, { time: new Date() }),
                action: () =>
                    h(
                        NButton,
                        {
                            onClick: () => {
                                window.chiya.route(
                                    `/experiments/${data.expid}`,
                                );
                                n.destroy();
                            },
                            text: true,
                        },
                        () => '查看实验',
                    ),
            });
        });
    },
    { immediate: true },
);

export const isMobile = ref(window.innerWidth < 960);
window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 960;
});

export const now = ref(new Date());
setInterval(() => {
    now.value = new Date();
}, 1000);

export default store;
