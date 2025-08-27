<template>
    <n-tag
        round
        :bordered="false"
        :color="{
            color: preset.color,
            textColor: preset.textColor,
        }"
    >
        <template #icon><n-mdi :icon="preset.icon || mdiCodeBlockTags"></n-mdi></template>
        <template v-if="preset.name">{{ preset.name }}</template>
        <n-code v-else>{{ props.language }}</n-code>
    </n-tag>
</template>

<script setup lang="ts">
import {
    mdiCodeBlockTags,
    mdiLanguageC,
    mdiLanguagePython,
    mdiLanguageRust,
} from '@mdi/js';
import { computed } from 'vue';
import NMdi from './mdi.vue';

const props = defineProps<{ language: string }>();

const preset = computed<{
    name?: string;
    icon?: string;
    color?: string;
    textColor?: string;
}>(
    () =>
        // https://github.com/inttter/md-badges#-programming-language
        ({
            c: {
                name: 'C',
                icon: mdiLanguageC,
                color: '#a8b9cc',
                textColor: '#fff',
            },
            cpp: {
                name: 'C++',
                // 使用 Simple Icons 的图标
                icon: 'M22.394 6c-.167-.29-.398-.543-.652-.69L12.926.22c-.509-.294-1.34-.294-1.848 0L2.26 5.31c-.508.293-.923 1.013-.923 1.6v10.18c0 .294.104.62.271.91.167.29.398.543.652.69l8.816 5.09c.508.293 1.34.293 1.848 0l8.816-5.09c.254-.147.485-.4.652-.69.167-.29.27-.616.27-.91V6.91c.003-.294-.1-.62-.268-.91zM12 19.11c-3.92 0-7.109-3.19-7.109-7.11 0-3.92 3.19-7.11 7.11-7.11a7.133 7.133 0 016.156 3.553l-3.076 1.78a3.567 3.567 0 00-3.08-1.78A3.56 3.56 0 008.444 12 3.56 3.56 0 0012 15.555a3.57 3.57 0 003.08-1.778l3.078 1.78A7.135 7.135 0 0112 19.11zm7.11-6.715h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79zm2.962 0h-.79v.79h-.79v-.79h-.79v-.79h.79v-.79h.79v.79h.79z',
                color: '#00599c',
                textColor: '#fff',
            },
            py: {
                name: 'Python',
                icon: mdiLanguagePython,
                color: '#3776ab',
                textColor: '#fff',
            },
            rs: {
                name: 'Rust',
                icon: mdiLanguageRust,
                color: '#000',
                textColor: '#fff',
            },
        })[props.language] || {},
);
</script>
