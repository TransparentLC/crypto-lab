<template>
    <n-h2>用户管理</n-h2>
    <n-space vertical>
        <n-table style="width:100%">
            <n-thead>
                <n-tr><n-th>用户 ID</n-th><n-th>用户名</n-th><n-th>已启用</n-th></n-tr>
            </n-thead>
            <n-tbody>
                <n-tr v-for="e in userData" :key="e.uid">
                    <n-td>{{ e.uid }}</n-td>
                    <n-td>
                        <span style="display:flex;align-items:center">
                            {{ e.username }}
                            <n-tooltip trigger="hover">
                                <template #trigger>
                                    <n-button @click="() => changeUsername(e)" text style="font-size:var(--n-icon-size);margin-left:var(--n-icon-margin)">
                                        <n-mdi :icon="mdiTagEditOutline"></n-mdi>
                                    </n-button>
                                </template>
                                修改用户名
                            </n-tooltip>
                            <n-tooltip trigger="hover">
                                <template #trigger>
                                    <n-button @click="() => getPasswordResetToken(e)" text style="font-size:var(--n-icon-size);margin-left:var(--n-icon-margin)">
                                        <n-mdi :icon="mdiLockReset"></n-mdi>
                                    </n-button>
                                </template>
                                重设密码
                            </n-tooltip>
                        </span>
                    </n-td>
                    <n-td>
                        <n-switch
                            v-model:value="e.enabled"
                            @update:value="(t: boolean) => changeUserEnabled(e, t)"
                        ></n-switch>
                    </n-td>
                </n-tr>
            </n-tbody>
        </n-table>
        <div style="display:flex;justify-content:right">
            <n-pagination
                v-model:page="userPage"
                :page-count="userPageCount"
                show-quick-jumper
                @update:page="(e: number) => updateUserData(e)"
            ></n-pagination>
        </div>
    </n-space>
    <n-divider></n-divider>
    <n-h2>添加用户</n-h2>
    <n-form
        :model="formCreateUser"
        :rules="{
            username: {
                required: true,
                trigger: 'blur',
                message: '请输入用户名',
            },
        }"
        label-placement="top"
        label-width="auto"
        :show-require-mark="false"
        style="max-width:480px"
    >
        <n-form-item label="用户名" path="oldPassword">
            <n-input
                v-model:value="formCreateUser.username"
                placeholder=""
                @keydown.enter="createUser"
            ></n-input>
        </n-form-item>
        <n-p style="margin-top:0">密码将在添加用户时随机生成。</n-p>
        <n-p>
            <n-space>
                <n-button
                    @click="createUser"
                    type="primary"
                    :loading="createUserLoading"
                    :disabled="
                        createUserLoading
                        || !formCreateUser.username
                    "
                >添加</n-button>
            </n-space>
        </n-p>
    </n-form>
    <n-divider></n-divider>
    <n-h2>实验管理</n-h2>
    <n-collapse>
        <n-collapse-item :title="'实验列表' + (experimentCurrentId ? `（当前已选择 #${experimentCurrentId}）` : '')">
            <n-table>
                <n-thead>
                    <n-tr><n-td>实验 ID</n-td><n-td>标题</n-td><n-td>操作</n-td></n-tr>
                </n-thead>
                <n-tbody>
                    <n-tr v-for="e in experimentData" :key="e.expid">
                        <n-td>{{ e.expid }}</n-td>
                        <n-td>{{ e.title }}</n-td>
                        <n-td><n-button type="primary" quaternary @click="loadExperiment(e.expid)">编辑</n-button></n-td>
                    </n-tr>
                </n-tbody>
            </n-table>
        </n-collapse-item>
        <n-collapse-item title="编辑实验">
            <n-form v-if="experimentCurrentId">
                <n-grid x-gap="12" cols="2">
                    <n-gi span="2">
                        <n-form-item label="标题">
                            <n-input v-model:value="experimentConfig.title" placeholder=""></n-input>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="说明">
                            <n-input
                                v-model:value="experimentConfig.description"
                                type="textarea"
                                style="height:32em"
                                :placeholder="'可以使用 Markdown 语法\n\n扩展：可以通过以下方式使用 <details> 和 <summary>\n\n> [@标题内容]\n>\n> 需要被折叠的内容'"
                            ></n-input>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="">
                            <n-card style="max-height:32em;overflow:hidden auto">
                                <n-marked :content="experimentConfig.description"></n-marked>
                            </n-card>
                        </n-form-item>
                    </n-gi>
                </n-grid>
                <n-grid x-gap="12" cols="4">
                    <n-gi>
                        <n-form-item label="编译时间限制">
                            <n-input-number v-model:value="experimentConfig.compileTimeLimit" step="1000" min="0" style="width:100%" placeholder="">
                                <template #suffix>ms</template>
                            </n-input-number>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="编译内存限制">
                            <n-input-number v-model:value="experimentConfig.compileMemoryLimit" step="1048576" min="0" style="width:100%" placeholder="">
                                <template #suffix>bytes</template>
                            </n-input-number>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="运行时间限制">
                            <n-input-number v-model:value="experimentConfig.runTimeLimit" step="1000" min="0" style="width:100%" placeholder="">
                                <template #suffix>ms</template>
                            </n-input-number>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="运行内存限制">
                            <n-input-number v-model:value="experimentConfig.runMemoryLimit" step="1048576" min="0" style="width:100%" placeholder="">
                                <template #suffix>bytes</template>
                            </n-input-number>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="CPU 限制">
                            <n-input-number v-model:value="experimentConfig.cpuLimit" step="1000" min="0" style="width:100%" placeholder="">
                                <template #suffix>×0.001 CPU</template>
                            </n-input-number>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-form-item label="测试点文件">
                            <input
                                ref="experimentCheckpointFileInput"
                                @change="() => experimentCheckpointFile = experimentCheckpointFileInput?.files?.[0]"
                                type="file"
                                accept=".zip"
                                style="display:none"
                            >
                            <n-button @click="experimentCheckpointFileInput?.click()">
                                <template #icon><n-mdi :icon="mdiFileUploadOutline"></n-mdi></template> 上传
                            </n-button>
                            <template v-if="experimentCheckpointFile">
                                <n-text style="margin-left:1em">{{ experimentCheckpointFile.name }}</n-text>
                                <n-button @click="experimentCheckpointFile = undefined; experimentCheckpointFileInput!.value = ''" text style="font-size:var(--n-icon-size);margin-left:var(--n-icon-margin)">
                                    <n-mdi :icon="mdiClose"></n-mdi>
                                </n-button>
                            </template>
                            <n-tooltip v-else trigger="hover">
                                <template #trigger>
                                    <n-text depth="3" style="margin-left:1em">（未修改）</n-text>
                                </template>
                                {{ experimentConfig.checkpointPath }}
                            </n-tooltip>
                        </n-form-item>
                    </n-gi>
                    <n-gi span="2">
                        <n-form-item label="起止时间">
                            <n-date-picker v-model:value="experimentConfig.rangeTime" type="datetimerange" style="width:100%"></n-date-picker>
                        </n-form-item>
                    </n-gi>
                    <n-gi span="4">
                        <n-form-item label="编译命令">
                            <n-table>
                                <n-thead>
                                    <n-tr><n-th style="width:8em">编程语言</n-th><n-th>编译命令 / shebang</n-th><n-th style="width:8em">操作</n-th></n-tr>
                                </n-thead>
                                <n-tbody>
                                    <n-tr v-for="e, i in experimentConfig.compileCommands" :key="e[0]">
                                        <n-td><n-input v-model:value="e[0]" placeholder="" style="width:100%"></n-input></n-td>
                                        <n-td><n-input v-model:value="e[1]" placeholder="" style="width:100%"></n-input></n-td>
                                        <n-td><n-button @click="experimentConfig.compileCommands.splice(i, 1)" type="error" quaternary>删除</n-button></n-td>
                                    </n-tr>
                                </n-tbody>
                            </n-table>
                        </n-form-item>
                    </n-gi>
                    <n-gi>
                        <n-space>
                            <n-switch v-model:value="experimentConfig.reportSubmission"></n-switch>
                            <n-text>需要提交实验报告</n-text>
                        </n-space>
                    </n-gi>
                </n-grid>
                <n-p>
                    <n-space>
                        <n-button
                            type="primary"
                            secondary
                            :loading="editExperimentLoading"
                            @click="editExperiment"
                        >保存</n-button>
                        <n-button
                            @click="experimentConfig.compileCommands.push(['xxx', 'xxx ${input} ${output}'])"
                            secondary
                        >添加编译命令</n-button>
                        <n-tooltip trigger="hover">
                            <template #trigger>
                                <n-button
                                    @click="obsoleteRejudge"
                                    type="warning"
                                    secondary
                                >重新评测</n-button>
                            </template>
                            废弃已有提交并重新评测每位用户的最后一次提交
                        </n-tooltip>
                    </n-space>
                </n-p>
            </n-form>
            <n-p v-else>请先在上面的表格中选择一个实验。</n-p>
        </n-collapse-item>
        <n-collapse-item title="导出数据">
            <n-space v-if="experimentCurrentId">
                <n-button
                    secondary
                    tag="a"
                    :href="`/api/admin/experiments/${experimentCurrentId}/submissions?token=${store.token}`"
                    download
                >
                    <template #icon><n-mdi :icon="mdiDownload"></n-mdi></template>
                    代码和评测结果
                </n-button>
                <n-button
                    secondary
                    tag="a"
                    :href="`/api/admin/experiments/${experimentCurrentId}/reports?token=${store.token}`"
                    download
                >
                    <template #icon><n-mdi :icon="mdiDownload"></n-mdi></template>
                    实验报告
                </n-button>
            </n-space>
            <n-p v-else>请先在上面的表格中选择一个实验。</n-p>
        </n-collapse-item>
    </n-collapse>
    <n-p>
        <n-space>
            <n-button
                @click="createExperiment"
                type="primary"
                :loading="createExperimentLoading"
            >创建空白实验</n-button>
        </n-space>
    </n-p>
</template>

<script setup lang="ts">
import {
    mdiClose,
    mdiDownload,
    mdiFileUploadOutline,
    mdiLockReset,
    mdiTagEditOutline,
} from '@mdi/js';
import { NButton, NCode, NInput, NSwitch, NText, NTime } from 'naive-ui';
import { h, onMounted, reactive, ref } from 'vue';
import NMarked from '../components/marked.js';
import NMdi from '../components/mdi.vue';
import http, {
    type ApiAdminExperiment,
    type ApiAdminUserCreate,
    ApiAdminUserPasswordResetToken,
    type ApiAdminUsers,
    type ApiExperimentList,
} from '../request.js';
import store from '../store.js';

const userPage = ref(1);
const userPageCount = ref(0);
const userData = reactive<ApiAdminUsers['rows']>([]);
const updateUserData = (page: number = 1) =>
    http
        .query({ page })
        .get('/admin/users')
        .json<ApiAdminUsers>()
        .then(r => {
            userData.length = 0;
            userData.push(...r.rows);
            userPageCount.value = r.pages;
        });

onMounted(() => updateUserData());

const getPasswordResetToken = async (user: ApiAdminUsers['rows'][number]) => {
    const r = await http
        .post(null, `/admin/users/${user.uid}/password-reset-token`)
        .json<ApiAdminUserPasswordResetToken>();
    window.chiya.dialog.create({
        title: `重设密码 #${user.uid}`,
        content: () => [
            `已为用户 #${user.uid} 生成重设密码令牌（点击复制）：`,
            h(NCode, {
                code: r.token,
                wordWrap: true,
                onClick: () =>
                    navigator.clipboard
                        .writeText(r.token)
                        .then(() => window.chiya.message.success('已复制令牌')),
                style: { cursor: 'pointer' },
            }),
            '令牌可以在 ',
            h(NTime, { time: new Date(r.expire) }),
            ' 前使用一次，使用后之前生成的令牌将会作废。',
        ],
        positiveText: '确认',
        maskClosable: false,
    });
};
const changeUsername = (user: ApiAdminUsers['rows'][number]) => {
    let value = user.username;
    const d = window.chiya.dialog.create({
        title: `修改用户名 #${user.uid}`,
        content: () =>
            h(NInput, {
                placeholder: '',
                defaultValue: value,
                'onUpdate:value': (e: string) => {
                    value = e;
                },
            }),
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: async () => {
            if (!value) return;
            d.loading = true;
            return http
                .patch({ username: value }, `/admin/users/${user.uid}`)
                .res()
                .then(() => {
                    window.chiya.message.success(
                        `已将 #${user.uid} 的用户名修改为“${value}”`,
                    );
                    updateUserData(userPageCount.value);
                });
        },
    });
};
const changeUserEnabled = (
    user: ApiAdminUsers['rows'][number],
    enabled: boolean,
) =>
    http
        .patch({ enabled }, `/admin/users/${user.uid}`)
        .res()
        .then(() =>
            window.chiya.message.success(
                `已${enabled ? '启用' : '禁用'}用户“${user.username}”`,
            ),
        );

const formCreateUser = reactive({
    username: '',
});
const createUserLoading = ref(false);
const createUser = async () => {
    try {
        const username = formCreateUser.username;
        createUserLoading.value = true;
        const r = await http
            .post({ username: formCreateUser.username }, '/admin/users')
            .json<ApiAdminUserCreate>();
        window.chiya.dialog.create({
            title: '添加用户',
            content: () => [
                `已添加用户“${username}”。`,
                h('br'),
                '该用户的初始密码为 ',
                h(
                    NText,
                    {
                        code: true,
                        onClick: () =>
                            navigator.clipboard
                                .writeText(r.password)
                                .then(() =>
                                    window.chiya.message.success('已复制密码'),
                                ),
                        style: { cursor: 'pointer' },
                    },
                    () => r.password,
                ),
                '（点击复制），此密码不会再显示，请注意保存。',
            ],
            positiveText: '确认',
            maskClosable: false,
        });
        formCreateUser.username = '';
        updateUserData();
    } catch {
    } finally {
        createUserLoading.value = false;
    }
};

const experimentData = reactive<ApiExperimentList>([]);

const updateExperimentData = () =>
    http
        .get('/admin/experiments')
        .json<ApiExperimentList>()
        .then(r => {
            experimentData.length = 0;
            experimentData.push(...r);
        });

onMounted(() => updateExperimentData());

const createExperimentLoading = ref(false);
const createExperiment = async () => {
    try {
        createExperimentLoading.value = true;
        await http.post(null, '/admin/experiments').res();
        window.chiya.message.success('已创建实验');
        updateExperimentData();
    } catch {
    } finally {
        createExperimentLoading.value = false;
    }
};

const experimentCurrentId = ref(0);
const experimentConfig = reactive({
    title: '',
    description: '',
    reportSubmission: false,
    cpuLimit: 0,
    compileTimeLimit: 0,
    compileMemoryLimit: 0,
    runTimeLimit: 0,
    runMemoryLimit: 0,
    rangeTime: [0, 0] as [number, number],
    compileCommands: [] as [string, string][],
    checkpointPath: '',
});
const experimentCheckpointFileInput = ref<HTMLInputElement | null>(null);
const experimentCheckpointFile = ref<File | undefined>(undefined);

const loadExperiment = (expid: number) =>
    http
        .get(`/admin/experiments/${expid}`)
        .json<ApiAdminExperiment>()
        .then(r => {
            experimentCurrentId.value = expid;
            Object.assign(experimentConfig, r);
            experimentConfig.rangeTime = [
                new Date(r.startTime).getTime(),
                new Date(r.endTime).getTime(),
            ];
            experimentConfig.compileCommands = Object.entries(
                r.compileCommands,
            );
            experimentCheckpointFile.value = undefined;
            if (experimentCheckpointFileInput.value) {
                experimentCheckpointFileInput.value.value = '';
            }
            window.chiya.message.success(`已读取实验 #${expid}`);
        });

const editExperimentLoading = ref(false);
const editExperiment = async () => {
    try {
        editExperimentLoading.value = true;
        await Promise.all([
            experimentCheckpointFile.value
                ? http
                      .post(
                          Object.entries({
                              file: experimentCheckpointFile.value,
                          } as Record<string, string | Blob>).reduce(
                              (a, [k, v]) => {
                                  a.append(k, v);
                                  return a;
                              },
                              new FormData(),
                          ),
                          `/admin/experiments/${experimentCurrentId.value}/checkpoint`,
                      )
                      .res()
                : Promise.resolve(),
            http
                .patch(
                    {
                        title: experimentConfig.title,
                        description: experimentConfig.description,
                        reportSubmission: experimentConfig.reportSubmission,
                        cpuLimit: experimentConfig.cpuLimit,
                        compileTimeLimit: experimentConfig.compileTimeLimit,
                        compileMemoryLimit: experimentConfig.compileMemoryLimit,
                        runTimeLimit: experimentConfig.runTimeLimit,
                        runMemoryLimit: experimentConfig.runMemoryLimit,
                        startTime: new Date(
                            experimentConfig.rangeTime[0],
                        ).toISOString(),
                        endTime: new Date(
                            experimentConfig.rangeTime[1],
                        ).toISOString(),
                        compileCommands: Object.fromEntries(
                            experimentConfig.compileCommands,
                        ),
                    },
                    `/admin/experiments/${experimentCurrentId.value}`,
                )
                .res(),
        ]);
        window.chiya.message.success(
            `已修改实验 #${experimentCurrentId.value}`,
        );
        updateExperimentData();
    } catch {
    } finally {
        editExperimentLoading.value = false;
    }
};

const obsoleteRejudge = () =>
    http
        .post(
            null,
            `/admin/experiments/${experimentCurrentId.value}/obsolete-rejudge`,
        )
        .res()
        .then(() =>
            window.chiya.message.success(
                `已重新评测实验 #${experimentCurrentId.value}`,
            ),
        );
</script>