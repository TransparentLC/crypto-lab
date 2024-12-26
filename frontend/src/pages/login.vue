<template>
    <n-form
        v-if="resetPasswordMode"
        :model="formResetPasswordValue"
        :rules="{
            token: {
                required: true,
                trigger: 'blur',
                message: '请输入重设密码令牌',
            },
            captcha: {
                required: true,
                trigger: 'blur',
            },
        }"
        label-placement="top"
        label-width="auto"
        :show-require-mark="false"
        style="max-width:480px;margin:0 auto"
    >
        <n-form-item label="重设密码令牌" path="username">
            <n-input
                v-model:value="formResetPasswordValue.token"
                type="textarea"
                placeholder="请联系管理员获取"
                rows="8"
                clearable
                :style="{ fontFamily: themeVars.fontFamilyMono, wordBreak: 'break-all' }"
            ></n-input>
        </n-form-item>
        <n-form-item label="人机验证">
            <vue-turnstile
                ref="captchaResetPassword"
                style="width:100%"
                :site-key="store.siteConfig.captchaSiteKey"
                action="crypto-lab-reset-password"
                size="flexible"
                v-model="formResetPasswordValue.captcha"
            ></vue-turnstile>
        </n-form-item>
        <n-button
            @click="resetPassword"
            type="primary"
            block
            :loading="loading"
            :disabled="
                loading
                || !formResetPasswordValue.token
                || !formResetPasswordValue.captcha
            "
        >重设密码</n-button>
        <n-p style="text-align:right">
            <n-a @click="resetPasswordMode = false">返回登录</n-a>
        </n-p>
    </n-form>
    <n-form
        v-else
        :model="formLoginValue"
        :rules="{
            username: {
                required: true,
                trigger: 'blur',
                message: '请输入用户名',
            },
            password: {
                required: true,
                trigger: 'blur',
                message: '请输入密码',
            },
            captcha: {
                required: true,
                trigger: 'blur',
            },
        }"
        label-placement="top"
        label-width="auto"
        :show-require-mark="false"
        style="max-width:480px;margin:0 auto"
    >
        <n-form-item label="用户名" path="username">
            <n-input
                v-model:value="formLoginValue.username"
                placeholder=""
                @keydown.enter="login"
            ></n-input>
        </n-form-item>
        <n-form-item label="密码" path="password">
            <n-input
                v-model:value="formLoginValue.password"
                type="password"
                show-password-on="mousedown"
                placeholder=""
                @keydown.enter="login"
            ></n-input>
        </n-form-item>
        <n-form-item label="人机验证">
            <vue-turnstile
                ref="captchaLogin"
                style="width:100%"
                :site-key="store.siteConfig.captchaSiteKey"
                action="crypto-lab-login"
                size="flexible"
                v-model="formLoginValue.captcha"
            ></vue-turnstile>
        </n-form-item>
        <n-button
            @click="login"
            type="primary"
            block
            :loading="loading"
            :disabled="
                loading
                || !formLoginValue.username
                || !formLoginValue.password
                || !formLoginValue.captcha
            "
        >登录</n-button>
        <n-p style="text-align:right">
            <n-a @click="resetPasswordMode = true">忘记密码</n-a>
        </n-p>
    </n-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import VueTurnstile from 'vue-turnstile';
import { NText, useThemeVars } from 'naive-ui';
import http, { type ApiResetPassword, type ApiLogin } from '../request.js';
import store from '../store.js';

const router = useRouter();
const themeVars = useThemeVars();

const resetPasswordMode = ref(false);

const captchaLogin = ref<typeof VueTurnstile | null>(null);
const loading = ref(false);
const formLoginValue = reactive({
    username: '',
    password: '',
    captcha: '',
});

const login = async () => {
    if (loading.value || !formLoginValue.username || !formLoginValue.password || !formLoginValue.captcha) return;
    try {
        loading.value = true;
        const r = await http
            .post(formLoginValue, '/login')
            .json<ApiLogin>();
        localStorage.setItem('token', store.token = r.token);
        window.chiya.message.success('登录成功');
        const route = router.currentRoute.value;
        router.push((Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect) || '/');
    } catch {} finally {
        loading.value = false;
        captchaLogin.value?.reset();
    }
};

const captchaResetPassword = ref<typeof VueTurnstile | null>(null);
const formResetPasswordValue = reactive({
    token: '',
    captcha: '',
});

const resetPassword = async () => {
    if (loading.value || !formResetPasswordValue.token || !formResetPasswordValue.captcha) return;
    try {
        loading.value = true;
        const r = await http
            .post(formResetPasswordValue, '/reset-password')
            .json<ApiResetPassword>();
        window.chiya.dialog.create({
            title: '重设密码',
            content: () => [
                `已将用户 #${r.uid} “${r.username}”的密码重设为 `,
                h(NText, {
                    code: true,
                    onClick: () => navigator.clipboard.writeText(r.password).then(() => window.chiya.message.success('已复制密码')),
                    style: { cursor: 'pointer' },
                }, () => r.password),
                '（点击复制），此密码不会再显示，请注意保存。',
            ],
            positiveText: '确认',
            maskClosable: false,
        });
        formResetPasswordValue.token = '';
    } catch {} finally {
        loading.value = false;
        captchaResetPassword.value?.reset();
    }
};

</script>