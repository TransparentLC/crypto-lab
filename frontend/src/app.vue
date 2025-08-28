<template>
    <n-config-provider
        :hljs="hljs"
        :katex="(katex as any)"
        :locale="zhCN"
        :date-locale="dateZhCN"
        :theme="theme"
        :theme-overrides="themeOverrides"
    >
        <n-space vertical size="large">
            <n-layout position="absolute">
                <n-layout-header style="padding:12px 24px;display:flex;align-items:center" bordered>
                    <n-button
                        v-if="isMobile"
                        text
                        circle
                        @click="menuDrawer = true"
                        style="margin-right:12px;font-size:24px"
                    >
                        <n-mdi :icon="mdiMenu"></n-mdi>
                    </n-button>
                    <img :src="store.siteConfig.theme.logo" height="36" style="transform:scale(1.2);transform-origin:left">
                    <div style="flex-grow:1"></div>
                    <router-link v-if="tokenPayload" to="/account" v-slot="{ navigate }">
                        <n-button quaternary @click="navigate">
                            <template #icon><n-mdi :icon="mdiAccount"></n-mdi></template>
                            {{ tokenPayload.username }}
                        </n-button>
                        <!-- <n-tooltip trigger="hover">
                            <template #trigger>
                                <n-button quaternary @click="navigate">
                                    <template #icon><n-mdi :icon="mdiAccount"></n-mdi></template>
                                    {{ tokenPayload.username }}
                                </n-button>
                            </template>
                            <pre><n-code :code="JSON.stringify(tokenPayload, null, 2)"></n-code></pre>
                        </n-tooltip> -->
                    </router-link>
                    <router-link v-else to="/login" v-slot="{ navigate }">
                        <n-button quaternary @click="navigate">
                            <template #icon><n-mdi :icon="mdiAccount"></n-mdi></template>
                            登录
                        </n-button>
                    </router-link>
                </n-layout-header>
                <n-layout has-sider position="absolute" style="top:64px">
                    <n-drawer v-if="isMobile" v-model:show="menuDrawer" placement="left">
                        <n-menu
                            :options="menuOptions"
                            :value="menuValue"
                            @update:value="menuDrawer = false"
                        ></n-menu>
                    </n-drawer>
                    <n-layout-sider
                        v-else
                        bordered
                        :collapsed="menuCollapsed"
                        :collapsed-width="64"
                        collapse-mode="width"
                        show-trigger
                        @collapse="menuCollapsed = true"
                        @expand="menuCollapsed = false"
                    >
                        <n-menu
                            :collapsed="menuCollapsed"
                            :collapsed-width="64"
                            :collapsed-icon-size="24"
                            :options="menuOptions"
                            :value="menuValue"
                        ></n-menu>
                    </n-layout-sider>
                    <n-layout-content content-style="padding:24px">
                        <router-view v-slot="{ Component, route }">
                            <keep-alive>
                                <component v-if="route.meta.keepAlive" :is="Component" :key="route.fullPath"></component>
                            </keep-alive>
                            <component v-if="!route.meta.keepAlive" :is="Component"></component>
                        </router-view>
                    </n-layout-content>
                </n-layout>
            </n-layout>
        </n-space>
    </n-config-provider>
</template>

<script setup lang="ts">
import hljs from 'highlight.js/lib/core';
import katex from 'katex';
import {
    type ConfigProviderProps,
    createDiscreteApi,
    darkTheme,
    dateZhCN,
    GlobalThemeOverrides,
    lightTheme,
    type MenuOption,
    useOsTheme,
    zhCN,
} from 'naive-ui';
import { computed, h, onMounted, ref } from 'vue';
import {
    type RouteLocationRaw,
    RouterLink,
    useRoute,
    useRouter,
} from 'vue-router';
import NMdi from './components/mdi.vue';
import 'katex/dist/katex.css';
import {
    mdiAccount,
    mdiAccountCog,
    mdiBookOpenBlankVariant,
    mdiHome,
    mdiMenu,
    mdiTools,
} from '@mdi/js';
import http, { type ApiExperimentList } from './request';
import store, { isMobile, tokenPayload } from './store';

const route = useRoute();
const router = useRouter();
const osTheme = useOsTheme();
const theme = computed(() =>
    osTheme.value === 'light' ? lightTheme : darkTheme,
);
const themeOverrides: GlobalThemeOverrides = {
    common: {
        fontFamilyMono:
            'v-mono, SFMono-Regular, Menlo, "Cascadia Code", Consolas, Courier, monospace',
        fontWeightStrong: 'bold',
        primaryColor: store.siteConfig.theme.color.primary,
        primaryColorHover: store.siteConfig.theme.color.hover,
        primaryColorPressed: store.siteConfig.theme.color.pressed,
        primaryColorSuppl: store.siteConfig.theme.color.suppl,
    },
};
const configProviderPropsRef = computed<ConfigProviderProps>(() => ({
    theme: theme.value,
    themeOverrides,
    locale: zhCN,
    dateLocale: dateZhCN,
}));

window.chiya = {
    ...createDiscreteApi(['message', 'dialog', 'notification'], {
        configProviderProps: configProviderPropsRef,
        notificationProviderProps: {
            placement: 'bottom-right',
        },
    }),
    route: (e: RouteLocationRaw) => router.push(e),
    getCurrentRoute: () => router.currentRoute.value,
};

const menuCollapsed = ref(false);
const menuDrawer = ref(false);

const makeMenuOption = (to: string, label: string, icon?: string) =>
    ({
        label: () => h(RouterLink, { to }, { default: () => label }),
        key: to,
        icon: icon ? () => h(NMdi, { icon }) : undefined,
    }) as MenuOption;

const menuOptions = computed(() => {
    return [
        makeMenuOption('/', '主页', mdiHome),
        {
            label: '实验',
            key: '/experiments',
            icon: () => h(NMdi, { icon: mdiBookOpenBlankVariant }),
            children: store.experiments.map(e =>
                makeMenuOption(`/experiments/${e.expid}`, e.title),
            ),
        } as MenuOption,
        {
            label: '工具',
            key: '/tools',
            icon: () => h(NMdi, { icon: mdiTools }),
            children: [
                makeMenuOption(`/tools/hex2bin`, '十六进制转二进制文件'),
                makeMenuOption(`/tools/statistics`, '全站提交统计'),
            ],
        } as MenuOption,
        {
            ...makeMenuOption('/admin', '管理员', mdiAccountCog),
            show: tokenPayload.value?.role === 'admin',
        } as MenuOption,
    ];
});

const menuValue = computed(() => route.path);

onMounted(async () => {
    store.experiments = await http
        .get('/experiments')
        .json<ApiExperimentList>();
});
</script>
