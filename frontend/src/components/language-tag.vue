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
    mdiLanguageCpp,
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
                color: '#00599c',
                textColor: '#fff',
            },
            cpp: {
                name: 'C++',
                icon: mdiLanguageCpp,
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
