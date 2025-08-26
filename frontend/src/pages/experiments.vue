<template>
    <n-space v-if="experimentLoading" vertical>
        <n-skeleton width="30%" :height="48" round></n-skeleton>
        <n-space>
            <n-skeleton :width="240" round size="small"></n-skeleton>
            <n-skeleton :width="120" round size="small"></n-skeleton>
            <n-skeleton :width="160" round size="small"></n-skeleton>
        </n-space>
        <n-skeleton text :repeat="2" :width="0"></n-skeleton>
        <div>
            <n-skeleton text :repeat="4"></n-skeleton>
            <n-skeleton text width="60%"></n-skeleton>
        </div>
    </n-space>
    <n-page-header v-else>
        <template #title>
            <n-h1>{{ experiment.title }}</n-h1>
            <n-space style="font-weight:initial">
                <n-tooltip trigger="hover">
                    <template #trigger>
                        <n-tag v-if="isMobile" round>
                            <template #icon><n-mdi :icon="mdiTimerOutline"></n-mdi></template>
                            截止时间：<n-time :time="experiment.endTime"></n-time>
                        </n-tag>
                        <n-tag v-else round>
                            <template #icon><n-mdi :icon="mdiTimerOutline"></n-mdi></template>
                            提交时间：<n-time :time="experiment.startTime"></n-time> - <n-time :time="experiment.endTime"></n-time>
                        </n-tag>
                    </template>
                    <template v-if="experiment.endTime < now">
                        已截止
                    </template>
                    <template v-else>
                        <n-time :time="experiment.endTime" :to="now" type="relative"></n-time>截止
                    </template>
                </n-tooltip>
                <n-tag round type="error" v-if="experiment.endTime < now">
                    <template #icon><n-mdi :icon="mdiTimerOutline"></n-mdi></template>
                    已截止
                </n-tag>
                <n-tag round type="warning" v-else-if="experiment.endTime.getTime() - now.getTime() < 86400000">
                    <template #icon><n-mdi :icon="mdiTimerOutline"></n-mdi></template>
                    <n-time :time="experiment.endTime" :to="now" type="relative"></n-time>截止
                </n-tag>
                <template v-if="experiment.reportSubmission">
                    <n-tag round type="success" v-if="experiment?.self?.report">
                        <template #icon><n-mdi :icon="mdiFileDocumentOutline"></n-mdi></template>
                        已提交实验报告
                    </n-tag>
                    <n-tag round v-else>
                        <template #icon><n-mdi :icon="mdiFileDocumentOutline"></n-mdi></template>
                        需要提交实验报告
                    </n-tag>
                </template>
                <template v-if="experiment?.self?.submitted">
                    <n-tag round v-if="experiment?.self?.accepted" type="success">
                        <template #icon><n-mdi :icon="mdiCodeBlockBraces"></n-mdi></template>
                        已提交代码（已 AC）
                    </n-tag>
                    <n-tag round v-else type="warning">
                        <template #icon><n-mdi :icon="mdiCodeBlockBraces"></n-mdi></template>
                        已提交代码（未 AC）
                    </n-tag>
                </template>
                <n-tag round v-else-if="experiment?.self && !experiment.self.submitted" type="warning">
                    <template #icon><n-mdi :icon="mdiCodeBlockBraces"></n-mdi></template>
                    未提交代码
                </n-tag>
            </n-space>
        </template>
        <n-tabs type="line" animated>
            <n-tab-pane name="descripetion" tab="实验描述">
                <n-space vertical>
                    <n-grid :cols="isMobile ? 2 : 5">
                        <n-gi>
                            <n-statistic label="编译时间限制" :value="`${experiment.compileTimeLimit} ms`" />
                        </n-gi>
                        <n-gi>
                            <n-statistic label="编译内存限制" :value="formatSize(experiment.compileMemoryLimit)" />
                        </n-gi>
                        <n-gi>
                            <n-statistic label="运行时间限制" :value="`${experiment.runTimeLimit} ms`" />
                        </n-gi>
                        <n-gi>
                            <n-statistic label="运行内存限制" :value="formatSize(experiment.runMemoryLimit)" />
                        </n-gi>
                        <n-gi v-if="!isMobile">
                            <n-statistic label="CPU 限制" :value="`${experiment.cpuLimit / 1000} vCPU`"></n-statistic>
                        </n-gi>
                    </n-grid>
                    <n-divider style="margin:0"></n-divider>
                    <n-marked :content="experiment.description"></n-marked>
                </n-space>
            </n-tab-pane>
            <n-tab-pane name="submission" tab="提交代码">
                <n-space vertical>
                    <template v-if="store.token">
                        <n-result
                            v-if="experiment.endTime < now"
                            title="实验已截止"
                            :description="mataraOkinaTriggered ? 'BGM. もうドアには入れない' : '门再也进不去了'"
                            style="margin:2em"
                        >
                            <template #icon>
                                <n-icon size="80" @click="mataraOkina += 1" style="cursor:pointer">
                                    <!-- https://upload.wikimedia.org/wikipedia/commons/7/75/Twemoji_1f4ba.svg -->
                                    <svg v-if="mataraOkinaTriggered" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 47.5 47.5"><defs><clipPath id="a"><path d="M0 38h38V0H0v38z"/></clipPath></defs><g clip-path="url(#a)" transform="matrix(1.25 0 0 -1.25 0 47.5)"><path fill="#9aaab4" d="M12 10a2 2 0 0 0-4 0v11a2 2 0 0 0 4 0V10zM32 10a2 2 0 0 0-4 0v11a2 2 0 0 0 4 0V10z"/><path fill="#67757f" d="M30 3a2 2 0 0 0-4 0v6a2 2 0 0 0 4 0V3zM14 3a2 2 0 0 0-4 0v6a2 2 0 0 0 4 0V3z"/><path fill="#4289c1" d="M30 19a4 4 0 0 0-4-4H14a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V19z"/><path fill="#e1e8ed" d="M24 29h-8v8h8v-8z"/><path fill="#ccd6dd" d="M12 22a2 2 0 0 0-2-2H8a2 2 0 0 0 0 4h2a2 2 0 0 0 2-2M34 22a2 2 0 0 0-2-2h-2a2 2 0 0 0 0 4h2a2 2 0 0 0 2-2"/><path fill="#5dadec" d="M30 14a3 3 0 0 0-3-3H13a3 3 0 1 0 0 6h14a3 3 0 0 0 3-3"/><path fill="#2a6797" d="M30 8H10v6h20V8z"/></g></svg>
                                    <!-- https://upload.wikimedia.org/wikipedia/commons/2/28/Twemoji_1f6aa.svg -->
                                    <svg v-else xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 47.5 47.5"><defs><clipPath id="a"><path d="M0 38h38V0H0v38z"/></clipPath></defs><g clip-path="url(#a)" transform="matrix(1.25 0 0 -1.25 0 47.5)"><path fill="#bcbec0" d="M35 5h-3v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V5H3a2 2 0 0 1 0-4h32a2 2 0 0 1 0 4"/><path fill="#be1931" d="M30 4a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3v28a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V4z"/><path fill="#f4900c" d="M15 17.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0"/><path fill="#ffd983" d="M14 17.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/><path fill="#ea596e" d="M27 21h-4a1 1 0 1 0 0 2h3v7a1 1 0 1 0 2 0v-8a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M21 23a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3v-7a1 1 0 0 0-1-1"/><path fill="#ea596e" d="M17 21h-4a1 1 0 0 0 0 2h3v7a1 1 0 0 0 2 0v-8a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M11 23a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4a1 1 0 0 0 0-2h-3v-7a1 1 0 0 0-1-1"/><path fill="#ea596e" d="M27 3h-4a1 1 0 1 0 0 2h3v6a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M21 5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3V6a1 1 0 0 0-1-1"/><path fill="#ea596e" d="M17 3h-4a1 1 0 1 0 0 2h3v6a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M11 5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3V6a1 1 0 0 0-1-1"/></g></svg>
                                </n-icon>
                            </template>
                            <template #footer>
                                <audio
                                    v-if="mataraOkinaTriggered"
                                    :src="
                                        (now.getHours() >= 18 || now.getHours() < 6)
                                            ? 'https://upload.thbwiki.cc/2/20/th175_23.mp3'
                                            : 'https://upload.thbwiki.cc/9/97/th16_14.mp3'
                                    "
                                    preload="metadata"
                                    controls
                                    loop
                                ></audio>
                            </template>
                        </n-result>
                        <n-upload
                            v-else
                            :accept="Object.keys(experiment.compileCommands).map(e => `.${e}`).join(',')"
                            :custom-request="submitCode"
                            v-model:file-list="submitCodeFileList"
                        >
                            <n-upload-dragger>
                                <div style="margin-bottom:1em">
                                    <n-mdi size="96" :depth="3" :icon="mdiUploadBoxOutline"></n-mdi>
                                </div>
                                <n-text style="font-size:1.5em">在此处提交代码</n-text>
                                <n-p depth="3">
                                    请提交一个 {{ formatSize(store.siteConfig.sizeLimit.code) }} 以内的源代码文件
                                    <br>
                                    提交后的代码将进入评测队列，请等待一段时间查看评测结果
                                    <br>
                                    如果你需要重新提交代码，请先等待之前提交的代码评测完成
                                    <br>
                                    请尽量不要在截止前掐点提交代码，否则有可能来不及修改
                                </n-p>
                            </n-upload-dragger>
                        </n-upload>
                    </template>
                    <n-result
                        v-else
                        status="418"
                        title="请先登录"
                        description="只有登录用户才能提交代码进行评测"
                        style="margin:2em"
                    >
                        <template #footer>
                            <router-link to="/login" v-slot="{ navigate }">
                                <n-button @click="navigate">前往登录页面</n-button>
                            </router-link>
                        </template>
                    </n-result>
                    <n-table>
                        <n-thead>
                            <n-tr><n-th>编程语言</n-th><n-th>编译命令</n-th></n-tr>
                        </n-thead>
                        <n-tbody>
                            <n-tr v-for="[k, v] in Object.entries(experiment.compileCommands)">
                                <n-td><n-text code>{{ k }}</n-text></n-td>
                                <n-td><n-text code>{{ v }}</n-text></n-td>
                            </n-tr>
                        </n-tbody>
                    </n-table>
                </n-space>
            </n-tab-pane>
            <n-tab-pane name="submissionHistory" tab="提交记录">
                <n-space vertical>
                    <div style="width:100%;overflow-x:auto">
                        <n-table>
                            <n-thead>
                                <n-tr>
                                    <n-th>提交 ID</n-th>
                                    <n-th>用户名</n-th>
                                    <n-th>提交时间</n-th>
                                    <n-th>语言</n-th>
                                    <n-th>代码长度</n-th>
                                    <n-th>评测结果</n-th>
                                    <n-th v-if="tokenPayload?.role === 'admin'"></n-th>
                                </n-tr>
                            </n-thead>
                            <n-tbody>
                                <n-tr v-for="e in submissionData" :key="e.subid">
                                    <n-td>{{ e.subid }}</n-td>
                                    <n-td>{{ e.username }}</n-td>
                                    <n-td><n-time :time="e.submitTime"></n-time></n-td>
                                    <n-td><n-text code>{{ e.language }}</n-text></n-td>
                                    <n-td>{{ e.length }}</n-td>
                                    <n-td>
                                        <n-tag
                                            v-if="e.pending"
                                            @click="showSubmissionResult(e)"
                                            :bordered="false"
                                            style="cursor:pointer"
                                        >
                                            <template #icon><n-mdi :icon="mdiCogs"></n-mdi></template>
                                            Pending
                                        </n-tag>
                                        <n-tag
                                            v-else-if="!e.compileSuccess"
                                            @click="showSubmissionResult(e)"
                                            :bordered="false"
                                            style="cursor:pointer"
                                            type="error"
                                        >
                                            <template #icon><n-mdi :icon="mdiCloseCircle"></n-mdi></template>
                                            Compile Error
                                        </n-tag>
                                        <n-tag
                                            v-else
                                            @click="showSubmissionResult(e)"
                                            :style="{
                                                cursor: 'pointer',
                                                background: (
                                                    e.subid === submissionDataSpecial.gold?.subid
                                                    ? 'linear-gradient(135deg,rgba(211,175,87,.25) 40%,rgba(211,175,87,.05) 50%,rgba(211,175,87,.25) 60%)'
                                                    : e.subid === submissionDataSpecial.silver?.subid
                                                        ? 'linear-gradient(135deg,rgba(160,160,160,.25) 40%,rgba(160,160,160,.05) 50%,rgba(160,160,160,.25) 60%)'
                                                        : e.subid === submissionDataSpecial.bronze?.subid
                                                            ? 'linear-gradient(135deg,rgba(205,127,50,.25) 40%,rgba(205,127,50,.05) 50%,rgba(205,127,50,.25) 60%)'
                                                            : undefined
                                                ),
                                                backgroundSize: '300%',
                                                animation: '2s infinite tag-highlight',
                                            }"
                                            :bordered="false"
                                            :color="(
                                                e.subid === submissionDataSpecial.gold?.subid
                                                ? { textColor: 'rgb(211,175,87)' }
                                                : e.subid === submissionDataSpecial.silver?.subid
                                                    ? { textColor: 'rgb(160,160,160)' }
                                                    : e.subid === submissionDataSpecial.bronze?.subid
                                                        ? { textColor: 'rgb(205,127,50)' }
                                                        : undefined
                                            )"
                                            :type="e.accepted! ? 'success' : 'warning'"
                                        >
                                            <template #icon><n-mdi
                                                :icon="(
                                                    e.accepted!
                                                        ? (
                                                            e.subid === submissionDataSpecial.gold?.subid ||
                                                            e.subid === submissionDataSpecial.silver?.subid ||
                                                            e.subid === submissionDataSpecial.bronze?.subid
                                                        )
                                                            ? mdiMedal
                                                            : mdiCheckCircle
                                                        : mdiBug
                                                    )"
                                            ></n-mdi></template>
                                            {{ e.time }} ms / {{ formatSize(e.memory!) }} / Accept {{ e.acceptedCount }}/{{ e.result!.length }}
                                        </n-tag>
                                    </n-td>
                                    <n-td v-if="tokenPayload?.role === 'admin'">
                                        <n-button
                                            @click="rejudge(e.subid)"
                                            type="error"
                                            size="small"
                                            secondary
                                            :disabled="e.pending"
                                        >重新评测</n-button>
                                    </n-td>
                                </n-tr>
                            </n-tbody>
                        </n-table>
                    </div>
                    <n-space style="display:flex;justify-content:right;align-items:center">
                        <n-el v-if="store.token">
                            <n-switch
                                v-model:value="submissionDataSelf"
                                @update:value="updateSubmissionData(parseInt(route.params.expid as string, 10), (submissionPage = 1), submissionDataSelf, submissionDataAccepted)"
                                :rail-style="({ checked, focused }) => ({
                                    background: checked ? 'var(--info-color)' : 'var(--primary-color)',
                                    boxShadow: focused ? `0 0 0 2px color-mix(in srgb, ${checked ? 'var(--info-color)' : 'var(--primary-color)'} 25%, transparent)` : undefined,
                                })"
                            >
                                <template #checked>查看自己的提交</template>
                                <template #unchecked>查看所有人的提交</template>
                            </n-switch>
                        </n-el>
                        <n-el>
                            <n-switch
                                v-model:value="submissionDataAccepted"
                                @update:value="updateSubmissionData(parseInt(route.params.expid as string, 10), (submissionPage = 1), submissionDataSelf, submissionDataAccepted)"
                                :rail-style="({ checked, focused }) => ({
                                    background: checked ? 'var(--success-color)' : 'var(--info-color)',
                                    boxShadow: focused ? `0 0 0 2px color-mix(in srgb, ${checked ? 'var(--success-color)' : 'var(--info-color)'} 25%, transparent)` : undefined,
                                })"
                            >
                                <template #checked>查看 AC 的提交</template>
                                <template #unchecked>查看所有状态的提交</template>
                            </n-switch>
                        </n-el>
                        <n-button
                            @click="updateSubmissionData(parseInt(route.params.expid as string, 10), submissionPage, submissionDataSelf, submissionDataAccepted)"
                            :loading="updateSubmissionDataLoading"
                        >
                            <template #icon><n-mdi :icon="mdiRefresh"></n-mdi></template>
                            刷新
                        </n-button>
                        <n-pagination
                            v-model:page="submissionPage"
                            :page-count="submissionPageCount"
                            show-quick-jumper
                            @update:page="(e: number) => updateSubmissionData(parseInt(route.params.expid as string, 10), e, submissionDataSelf, submissionDataAccepted)"
                        ></n-pagination>
                    </n-space>
                </n-space>
            </n-tab-pane>
            <n-tab-pane v-if="experiment.reportSubmission" name="report" tab="提交实验报告">
                <n-space vertical>
                    <template v-if="store.token">
                        <n-result
                            v-if="experiment.endTime < now"
                            title="实验已截止"
                            :description="mataraOkinaTriggered ? 'BGM. もうドアには入れない' : '门再也进不去了'"
                            style="margin:2em"
                        >
                            <template #icon>
                                <n-icon size="80" @click="mataraOkina += 1" style="cursor:pointer">
                                    <!-- https://upload.wikimedia.org/wikipedia/commons/7/75/Twemoji_1f4ba.svg -->
                                    <svg v-if="mataraOkinaTriggered" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 47.5 47.5"><defs><clipPath id="a"><path d="M0 38h38V0H0v38z"/></clipPath></defs><g clip-path="url(#a)" transform="matrix(1.25 0 0 -1.25 0 47.5)"><path fill="#9aaab4" d="M12 10a2 2 0 0 0-4 0v11a2 2 0 0 0 4 0V10zM32 10a2 2 0 0 0-4 0v11a2 2 0 0 0 4 0V10z"/><path fill="#67757f" d="M30 3a2 2 0 0 0-4 0v6a2 2 0 0 0 4 0V3zM14 3a2 2 0 0 0-4 0v6a2 2 0 0 0 4 0V3z"/><path fill="#4289c1" d="M30 19a4 4 0 0 0-4-4H14a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V19z"/><path fill="#e1e8ed" d="M24 29h-8v8h8v-8z"/><path fill="#ccd6dd" d="M12 22a2 2 0 0 0-2-2H8a2 2 0 0 0 0 4h2a2 2 0 0 0 2-2M34 22a2 2 0 0 0-2-2h-2a2 2 0 0 0 0 4h2a2 2 0 0 0 2-2"/><path fill="#5dadec" d="M30 14a3 3 0 0 0-3-3H13a3 3 0 1 0 0 6h14a3 3 0 0 0 3-3"/><path fill="#2a6797" d="M30 8H10v6h20V8z"/></g></svg>
                                    <!-- https://upload.wikimedia.org/wikipedia/commons/2/28/Twemoji_1f6aa.svg -->
                                    <svg v-else xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 47.5 47.5"><defs><clipPath id="a"><path d="M0 38h38V0H0v38z"/></clipPath></defs><g clip-path="url(#a)" transform="matrix(1.25 0 0 -1.25 0 47.5)"><path fill="#bcbec0" d="M35 5h-3v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V5H3a2 2 0 0 1 0-4h32a2 2 0 0 1 0 4"/><path fill="#be1931" d="M30 4a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3v28a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V4z"/><path fill="#f4900c" d="M15 17.5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0"/><path fill="#ffd983" d="M14 17.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/><path fill="#ea596e" d="M27 21h-4a1 1 0 1 0 0 2h3v7a1 1 0 1 0 2 0v-8a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M21 23a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3v-7a1 1 0 0 0-1-1"/><path fill="#ea596e" d="M17 21h-4a1 1 0 0 0 0 2h3v7a1 1 0 0 0 2 0v-8a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M11 23a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4a1 1 0 0 0 0-2h-3v-7a1 1 0 0 0-1-1"/><path fill="#ea596e" d="M27 3h-4a1 1 0 1 0 0 2h3v6a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M21 5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3V6a1 1 0 0 0-1-1"/><path fill="#ea596e" d="M17 3h-4a1 1 0 1 0 0 2h3v6a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1"/><path fill="#a0041e" d="M11 5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2h-3V6a1 1 0 0 0-1-1"/></g></svg>
                                </n-icon>
                            </template>
                            <template #footer>
                                <audio
                                    v-if="mataraOkinaTriggered"
                                    :src="
                                        (now.getHours() >= 18 || now.getHours() < 6)
                                            ? 'https://upload.thbwiki.cc/2/20/th175_23.mp3'
                                            : 'https://upload.thbwiki.cc/9/97/th16_14.mp3'
                                    "
                                    preload="metadata"
                                    controls
                                    loop
                                ></audio>
                            </template>
                        </n-result>
                        <n-upload
                            v-else
                            :accept="'.pdf'"
                            :custom-request="submitReport"
                            v-model:file-list="submitReportFileList"
                        >
                            <n-upload-dragger>
                                <div style="margin-bottom:1em">
                                    <n-mdi size="96" :depth="3" :icon="mdiUploadBoxOutline"></n-mdi>
                                </div>
                                <n-text style="font-size:1.5em">在此处提交实验报告</n-text>
                                <n-p depth="3">
                                    请提交一个 {{ formatSize(store.siteConfig.sizeLimit.report) }} 以内的 PDF 文件
                                    <br>
                                    如果已经提交过了也可以重新提交
                                </n-p>
                            </n-upload-dragger>
                        </n-upload>
                        <n-alert v-if="experiment.self?.report" type="success">
                            你已经提交过实验报告了，可以点击<n-a :href="`/api/experiments/${route.params.expid}/reports?token=${store.token}`" target="_blank">这里</n-a>查看。
                        </n-alert>
                    </template>
                    <n-result
                        v-else
                        status="418"
                        title="请先登录"
                        description="只有登录用户才能提交实验报告"
                        style="margin:2em"
                    >
                        <template #footer>
                            <router-link to="/login" v-slot="{ navigate }">
                                <n-button @click="navigate">前往登录页面</n-button>
                            </router-link>
                        </template>
                    </n-result>
                </n-space>
            </n-tab-pane>
        </n-tabs>
    </n-page-header>
</template>

<style>
@keyframes tag-highlight {
    from {
        background-position: 0% 50%;
    }
    to {
        background-position: 100% 50%;
    }
}
</style>

<script setup lang="ts">
import {
    mdiBug,
    mdiCheckCircle,
    mdiCloseCircle,
    mdiCodeBlockBraces,
    mdiCogs,
    mdiFileDocumentOutline,
    mdiMedal,
    mdiRefresh,
    mdiTimerOutline,
    mdiUploadBoxOutline,
} from '@mdi/js';
import hljs from 'highlight.js/lib/core';
import {
    NA,
    NCode,
    NH3,
    NLog,
    NSpace,
    NTable,
    NTbody,
    NTd,
    NText,
    NTh,
    NThead,
    NTr,
    type UploadCustomRequestOptions,
    type UploadFileInfo,
} from 'naive-ui';
import { computed, h, onMounted, reactive, ref } from 'vue';
import { onBeforeRouteUpdate, useRoute } from 'vue-router';
import NMarked from '../components/marked.js';
import NMdi from '../components/mdi.vue';
import formatSize from '../format-size.js';
import http, {
    type ApiExperiment,
    type ApiExperimentSubmissions,
} from '../request.js';
import store, { isMobile, now, tokenPayload } from '../store.js';

const route = useRoute();

const experimentLoading = ref(true);

const experiment = reactive<
    Omit<ApiExperiment, 'startTime' | 'endTime'> & {
        startTime: Date;
        endTime: Date;
    }
>({
    title: '',
    description: '',
    reportSubmission: false,
    cpuLimit: 0,
    compileTimeLimit: 0,
    compileMemoryLimit: 0,
    runTimeLimit: 0,
    runMemoryLimit: 0,
    startTime: new Date(),
    endTime: new Date(),
    compileCommands: {},
    checkpointNotes: [],
});

const loadExperiment = async (expid: number) => {
    const t = setTimeout(() => {
        experimentLoading.value = true;
    }, 200);
    try {
        await http
            .get(`/experiments/${expid}`)
            .json<ApiExperiment>()
            .then(r =>
                Object.assign(experiment, {
                    ...r,
                    startTime: new Date(r.startTime),
                    endTime: new Date(r.endTime),
                }),
            );
    } catch {
    } finally {
        clearTimeout(t);
        experimentLoading.value = false;
    }
};

onMounted(() => loadExperiment(parseInt(route.params.expid as string, 10)));
onBeforeRouteUpdate(to => {
    loadExperiment(parseInt(to.params.expid as string, 10));
});

const submitCodeFileList = ref<UploadFileInfo[]>([]);
const submitCode = async (options: UploadCustomRequestOptions) => {
    const pt = Date.now();
    let ps = true;
    const pf = () => {
        // -(1.001^{-x})+1
        options.onProgress({
            percent: (-(1.001 ** -(Date.now() - pt)) + 1) * 100,
        });
        if (ps) requestAnimationFrame(pf);
    };
    requestAnimationFrame(pf);
    try {
        // biome-ignore lint/style/noNonNullAssertion: file 必定存在
        const file = options.file.file!;
        const code = (await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onerror = reject;
            fr.onload = () => resolve(fr.result as string);
            fr.readAsText(file);
        })) as string;
        await http
            .post(
                {
                    code,
                    language:
                        file.name.substring(
                            file.name.lastIndexOf('.') + 1,
                            file.name.length,
                        ) || file.name,
                },
                `/experiments/${route.params.expid}/submissions`,
            )
            .res();
        window.chiya.message.success('已提交代码');
        options.onFinish();
        submissionPage.value = 1;
        updateSubmissionData(
            parseInt(route.params.expid as string, 10),
            submissionPage.value,
            submissionDataSelf.value,
            submissionDataAccepted.value,
        );
    } catch {
        options.onError();
    } finally {
        submitCodeFileList.value.length = 0;
        ps = false;
    }
};

const submissionPage = ref(1);
const submissionPageCount = ref(0);
const submissionData = reactive<
    (Omit<ApiExperimentSubmissions['rows'][number], 'submitTime'> & {
        submitTime: Date;
    })[]
>([]);
const submissionDataSpecial = reactive<ApiExperimentSubmissions['special']>({});
const submissionDataSelf = ref(false);
const submissionDataAccepted = ref(false);
const updateSubmissionDataLoading = ref(false);
const updateSubmissionData = async (
    expid: number,
    page: number,
    self: boolean,
    accepted: boolean,
) => {
    try {
        updateSubmissionDataLoading.value = true;
        const r = await http
            .query({ page, self, accepted })
            .get(`/experiments/${expid}/submissions`)
            .json<ApiExperimentSubmissions>();
        submissionData.length = 0;
        submissionData.push(
            ...r.rows.map(e =>
                Object.assign(e, { submitTime: new Date(e.submitTime) }),
            ),
        );
        submissionPageCount.value = r.pages;
        Object.assign(submissionDataSpecial, r.special);
    } catch {
    } finally {
        updateSubmissionDataLoading.value = false;
    }
};

onMounted(() => {
    submissionPage.value = 1;
    updateSubmissionData(
        parseInt(route.params.expid as string, 10),
        submissionPage.value,
        submissionDataSelf.value,
        submissionDataAccepted.value,
    );
});
onBeforeRouteUpdate(to => {
    submissionPage.value = 1;
    updateSubmissionData(
        parseInt(to.params.expid as string, 10),
        submissionPage.value,
        submissionDataSelf.value,
        submissionDataAccepted.value,
    );
});

const showSubmissionResult = (
    submission: Omit<ApiExperimentSubmissions['rows'][number], 'submitTime'> & {
        submitTime: Date;
    },
) => {
    const codeUrl =
        submission.code !== null
            ? URL.createObjectURL(
                  new Blob([submission.code], { type: 'plain/text' }),
              )
            : '';
    window.chiya.dialog.create({
        title: `提交记录 #${submission.subid}`,
        content: () =>
            h(
                NSpace,
                {
                    vertical: true,
                    style: 'max-height:calc(100vh - 160px);overflow-y:auto',
                },
                () => [
                    h('div', { style: 'display:flex;align-items:center' }, [
                        h(NH3, { style: 'margin:0' }, () => '源代码'),
                        h('div', { style: 'flex-grow:1' }),
                        ...(submission.code !== null
                            ? [
                                  h(
                                      NA,
                                      {
                                          href: codeUrl,
                                          download: `submission-${submission.subid}.${submission.language}`,
                                      },
                                      () => '保存',
                                  ),
                              ]
                            : []),
                    ]),
                    ...(submission.code !== null
                        ? [
                              h(NCode, {
                                  hljs,
                                  code: submission.code,
                                  language: submission.language,
                                  showLineNumbers: true,
                                  style: 'max-height:360px;overflow-y:auto',
                              }),
                          ]
                        : [
                              h(
                                  NText,
                                  { depth: 3 },
                                  () => '只有提交的用户自己才可以查看',
                              ),
                          ]),
                    h(NH3, { style: 'margin:0' }, () => '编译输出'),
                    ...(submission.compileOutput !== null
                        ? [
                              submission.compileOutput
                                  ? h(NLog, {
                                        log: submission.compileOutput,
                                        rows: 15,
                                    })
                                  : h(NText, { depth: 3 }, () => '没有输出'),
                          ]
                        : [
                              h(NText, { depth: 3 }, () =>
                                  submission.pending
                                      ? '请等待评测完成'
                                      : '只有提交的用户自己才可以查看',
                              ),
                          ]),
                    ...(submission.result?.length
                        ? [
                              h(NH3, { style: 'margin:0' }, () => '评测结果'),
                              h(NTable, () => [
                                  h(
                                      NThead,
                                      {
                                          style: 'display:table;table-layout:fixed;width:100%',
                                      },
                                      () => [
                                          h(NTr, () => [
                                              h(NTh, () => '测试点'),
                                              h(NTh, () => '时间'),
                                              h(NTh, () => '内存'),
                                              h(NTh, () => '结果'),
                                              h(NTh, () => '提示'),
                                          ]),
                                      ],
                                  ),
                                  h(
                                      NTbody,
                                      {
                                          style: 'display:block;max-height:250px;overflow-y:auto',
                                      },
                                      () =>
                                          submission.result?.map((e, i) => [
                                              h(
                                                  NTr,
                                                  {
                                                      style: 'display:table;table-layout:fixed;width:100%',
                                                  },
                                                  () => [
                                                      h(NTd, () => `#${i + 1}`),
                                                      h(
                                                          NTd,
                                                          () => `${e.time} ms`,
                                                      ),
                                                      h(NTd, () =>
                                                          formatSize(e.memory),
                                                      ),
                                                      h(NTd, () =>
                                                          h(
                                                              NText,
                                                              {
                                                                  type:
                                                                      e.status ===
                                                                      'Accepted'
                                                                          ? 'success'
                                                                          : 'error',
                                                                  underline:
                                                                      !!e.stderr,
                                                                  title: e.stderr,
                                                                  style: e.stderr
                                                                      ? {
                                                                            textDecorationStyle:
                                                                                'dashed',
                                                                            cursor: 'help',
                                                                        }
                                                                      : null,
                                                              },
                                                              e.status,
                                                          ),
                                                      ),
                                                      h(
                                                          NTd,
                                                          () =>
                                                              experiment
                                                                  .checkpointNotes[
                                                                  i
                                                              ] || '',
                                                      ),
                                                  ],
                                              ),
                                          ]),
                                  ),
                              ]),
                          ]
                        : []),
                ],
            ),
        positiveText: '确定',
        style: 'width:640px',
        onClose: () => URL.revokeObjectURL(codeUrl),
    });
};

const submitReportFileList = ref<UploadFileInfo[]>([]);
const submitReport = async (options: UploadCustomRequestOptions) => {
    const pt = Date.now();
    let ps = true;
    const pf = () => {
        // -(1.001^{-x})+1
        options.onProgress({
            percent: (-(1.001 ** -(Date.now() - pt)) + 1) * 100,
        });
        if (ps) requestAnimationFrame(pf);
    };
    requestAnimationFrame(pf);
    try {
        // biome-ignore lint/style/noNonNullAssertion: file 必定存在
        const file = options.file.file!;
        const fd = new FormData();
        fd.append('file', file);
        await http.post(fd, `/experiments/${route.params.expid}/reports`).res();
        window.chiya.message.success('已提交实验报告');
        options.onFinish();
        loadExperiment(parseInt(route.params.expid as string, 10));
    } catch {
        options.onError();
    } finally {
        submitReportFileList.value.length = 0;
        ps = false;
    }
};

const rejudge = (subid: number) =>
    http
        .post(null, `/admin/submissions/${subid}/rejudge`)
        .res()
        .then(() => {
            window.chiya.message.success(`已重新评测提交 #${subid}`);
            updateSubmissionData(
                parseInt(route.params.expid as string, 10),
                submissionPage.value,
                submissionDataSelf.value,
                submissionDataAccepted.value,
            );
        });

const mataraOkina = ref(0);
const mataraOkinaTriggered = computed(() => mataraOkina.value >= 5);
</script>