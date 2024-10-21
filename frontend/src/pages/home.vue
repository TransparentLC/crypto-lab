<template>
    <n-space v-if="loading" vertical>
        <n-skeleton width="30%" :height="48" round></n-skeleton>
        <div>
            <n-skeleton text :repeat="2"></n-skeleton>
            <n-skeleton text width="50%"></n-skeleton>
        </div>
        <div>
            <n-skeleton text :repeat="3"></n-skeleton>
            <n-skeleton text width="70%"></n-skeleton>
        </div>
        <div>
            <n-skeleton text :repeat="1"></n-skeleton>
            <n-skeleton text width="40%"></n-skeleton>
        </div>
    </n-space>
    <n-marked v-else :content="homepage"></n-marked>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import NMarked from '../components/marked.js';
import http from '../request.js';

const homepage = ref('');
const loading = ref(true);

onMounted(() => http.url('resources/homepage.md', true).get().text(r => homepage.value = r).finally(() => loading.value = false));

</script>