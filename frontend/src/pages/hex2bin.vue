<template>
    <n-h2>十六进制转二进制文件</n-h2>
    <n-p>你可以在这里转换“样例数据”中用十六进制表示的二进制文件。</n-p>
    <n-input
        v-model:value="hexdump"
        type="textarea"
        rows="8"
        :placeholder="placeholder"
        :style="{ fontFamily: themeVars.fontFamilyMono, maxWidth: '480px' }"
    ></n-input>
    <n-p>
        <n-button @click="convert" type="primary">
            <template #icon><n-mdi :icon="mdiSwapHorizontal"></n-mdi></template>
            转换
        </n-button>
    </n-p>
</template>

<script setup lang="ts">
import { mdiSwapHorizontal } from '@mdi/js';
import { useThemeVars } from 'naive-ui';
import { ref } from 'vue';
import NMdi from '../components/mdi.vue';
import { isMobile } from '../store';

const themeVars = useThemeVars();

const placeholder = [
    ...Array.from(Array(4), () =>
        Array.from(Array(isMobile.value ? 8 : 16), () =>
            Math.floor(Math.random() * 256)
                .toString(16)
                .padStart(2, '0')
                .toUpperCase(),
        ).join(' '),
    ),
    '...',
].join('\n');

const hexdump = ref('');
const convert = () => {
    const el = document.createElement('a');
    el.download = 'dump.bin';
    el.href = URL.createObjectURL(
        new Blob([
            new Uint8Array(
                (hexdump.value.match(/[\da-f]{1,2}/gi) ?? []).map(e =>
                    parseInt(e, 16),
                ),
            ),
        ]),
    );
    el.click();
    URL.revokeObjectURL(el.href);
};
</script>