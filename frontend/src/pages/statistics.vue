<template>
    <n-h2>全站提交统计</n-h2>
    <n-p>显示最近一周在实验网站提交代码的次数。</n-p>
    <n-text v-if="isMobile" italic>请在桌面端查看图表</n-text>
    <div v-else style="position:relative;width:100%">
        <line-chart
            :style="{
                width: '100%',
            }"
            :data="{
                datasets: [
                    {
                        label: 'Submission',
                        data: statisticsData.map(e => ({ x: new Date(e.time).getTime(), y: e.submission })),
                        fill: false,
                        cubicInterpolationMode: 'monotone',
                        borderColor: '#36a2eb',
                        pointBackgroundColor: '#36a2eb',
                    },
                    {
                        label: 'Compiled',
                        data: statisticsData.map(e => ({ x: new Date(e.time).getTime(), y: e.compiled })),
                        fill: false,
                        cubicInterpolationMode: 'monotone',
                        borderColor: '#ffcd56',
                        pointBackgroundColor: '#ffcd56',
                    },
                    {
                        label: 'Accepted',
                        data: statisticsData.map(e => ({ x: new Date(e.time).getTime(), y: e.accepted })),
                        fill: false,
                        cubicInterpolationMode: 'monotone',
                        borderColor: '#42b983',
                        pointBackgroundColor: '#42b983',
                    },
                ],
            }"
            :options="{
                aspectRatio: 3,
                scales: {
                    y: {
                        ticks: {
                            stepSize: 1,
                        },
                    },
                    x: {
                        offset: true,
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: {
                                hour: 'yyyy-LL-dd HH:mm',
                            },
                        },
                    },
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                        },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x',
                        },
                    },
                },
                transitions: {
                    zoom: {
                        animation: {
                            duration: 200,
                            easing: 'easeOutCubic',
                        },
                    },
                },
            }"
        ></line-chart>
    </div>
    <n-p>
        <n-button @click="refresh" type="primary" :loading="chartLoading">
            <template #icon><n-mdi :icon="mdiRefresh"></n-mdi></template>
            刷新
        </n-button>
    </n-p>
</template>

<script setup lang="ts">
import { mdiRefresh } from '@mdi/js';
import {
    Chart,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    TimeScale,
    Tooltip,
} from 'chart.js';
import { onMounted, ref } from 'vue';
import { Line as LineChart } from 'vue-chartjs';
import 'chartjs-adapter-date-fns';
import chartjsZoomPlugin from 'chartjs-plugin-zoom';
import NMdi from '../components/mdi.vue';
import http, { type ApiStatistics } from '../request.js';
import { isMobile } from '../store.js';

Chart.register(
    Legend,
    Tooltip,
    LinearScale,
    TimeScale,
    PointElement,
    LineElement,
    chartjsZoomPlugin,
);

const chartLoading = ref(false);

const statisticsData = ref<ApiStatistics>([]);

const refresh = async () => {
    chartLoading.value = true;
    try {
        statisticsData.value = await http
            .get('/statistics')
            .json<ApiStatistics>()
            .then();
    } catch {
    } finally {
        chartLoading.value = false;
    }
};
onMounted(refresh);
</script>