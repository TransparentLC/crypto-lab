<template>
    <div v-if="registerMode" style="max-width:480px;margin:0 auto">
        <n-p>输入用户名和邮箱获得注册令牌，然后粘贴到这里。令牌验证通过后系统为你会生成新的密码。</n-p>
        <n-p>允许使用的邮箱域名：<template v-for="(e, i) in store.siteConfig.emailRegistrationDomainWhitelist">
            <template v-if="i">、</template><n-code>{{ e }}</n-code>
        </template></n-p>
        <n-form
            :model="formRegisterTokenValue"
            :rules="{
                username: {
                    required: true,
                    trigger: 'blur',
                    message: '请输入用户名',
                },
                email: {
                    required: true,
                    trigger: 'blur',
                    message: '请输入邮箱',
                    type: 'email',
                },
                captcha: {
                    required: true,
                    trigger: 'blur',
                },
            }"
            label-placement="top"
            label-width="auto"
            :show-require-mark="false"
        >
            <n-form-item label="用户名" path="username">
                <n-input
                    v-model:value="formRegisterTokenValue.username"
                    type="text"
                    clearable
                    @keydown.enter="getRegisterToken"
                ></n-input>
            </n-form-item>
            <n-form-item label="邮箱" path="email">
                <n-input
                    v-model:value="formRegisterTokenValue.email"
                    type="text"
                    clearable
                    @keydown.enter="getRegisterToken"
                ></n-input>
            </n-form-item>
            <n-form-item label="人机验证">
                <vue-turnstile
                    ref="captchaRegister"
                    style="width:100%"
                    :site-key="store.siteConfig.captchaSiteKey"
                    action="crypto-lab-register-token"
                    size="flexible"
                    v-model="formRegisterTokenValue.captcha"
                ></vue-turnstile>
            </n-form-item>
            <n-button
                @click="getRegisterToken"
                type="primary"
                :loading="loading"
                :disabled="
                    loading
                    || !formRegisterTokenValue.username
                    || !formRegisterTokenValue.email
                    || !formRegisterTokenValue.captcha
                "
            >发送令牌</n-button>
        </n-form>
        <n-divider></n-divider>
        <n-form
            :model="formRegisterValue"
            :rules="{
                token: {
                    required: true,
                    trigger: 'blur',
                    message: '请输入注册令牌',
                },
            }"
            label-placement="top"
            label-width="auto"
            :show-require-mark="false"
        >
            <n-form-item label="注册令牌" path="token">
                <n-input
                    v-model:value="formRegisterValue.token"
                    type="textarea"
                    placeholder="请从邮件中获取"
                    rows="8"
                    clearable
                    :style="{ fontFamily: themeVars.fontFamilyMono, wordBreak: 'break-all' }"
                    @keydown.enter="register"
                ></n-input>
            </n-form-item>
            <n-button
                @click="register"
                type="primary"
                block
                :loading="loading"
                :disabled="
                    loading
                    || !formRegisterValue.token
                "
            >注册</n-button>
        </n-form>
        <n-p style="text-align:right">
            <n-a @click="registerMode = false">返回登录</n-a>
        </n-p>
    </div>
    <div v-else-if="resetPasswordMode" style="max-width:480px;margin:0 auto">
        <n-p>如果需要重设密码，你需要输入用户名和注册时使用的邮箱获得重设密码令牌，然后粘贴到这里。令牌验证通过后系统为你会生成新的密码。</n-p>
        <n-p>注意：为了防止滥用，每次重设密码后会有一定的冷却时间，在 <n-time :time="0" :to="-store.siteConfig.passwordResetCooldown * 1000" type="relative"></n-time>无法再次重设密码。</n-p>
        <n-form
            :model="formPasswordResetTokenValue"
            :rules="{
                username: {
                    required: true,
                    trigger: 'blur',
                    message: '请输入用户名',
                },
                email: {
                    required: true,
                    trigger: 'blur',
                    message: '请输入邮箱',
                    type: 'email',
                },
                captcha: {
                    required: true,
                    trigger: 'blur',
                },
            }"
            label-placement="top"
            label-width="auto"
            :show-require-mark="false"
        >
            <n-form-item label="用户名" path="username">
                <n-input
                    v-model:value="formPasswordResetTokenValue.username"
                    type="text"
                    clearable
                    @keydown.enter="getPasswordResetToken"
                ></n-input>
            </n-form-item>
            <n-form-item label="邮箱" path="email">
                <n-input
                    v-model:value="formPasswordResetTokenValue.email"
                    type="text"
                    clearable
                    @keydown.enter="getPasswordResetToken"
                ></n-input>
            </n-form-item>
            <n-form-item label="人机验证">
                <vue-turnstile
                    ref="captchaResetPassword"
                    style="width:100%"
                    :site-key="store.siteConfig.captchaSiteKey"
                    action="crypto-lab-password-reset-token"
                    size="flexible"
                    v-model="formPasswordResetTokenValue.captcha"
                ></vue-turnstile>
            </n-form-item>
            <n-button
                @click="getPasswordResetToken"
                type="primary"
                :loading="loading"
                :disabled="
                    loading
                    || !formPasswordResetTokenValue.username
                    || !formPasswordResetTokenValue.email
                    || !formPasswordResetTokenValue.captcha
                "
            >发送令牌</n-button>
        </n-form>
        <n-divider></n-divider>
        <n-form
            :model="formResetPasswordValue"
            :rules="{
                token: {
                    required: true,
                    trigger: 'blur',
                    message: '请输入重设密码令牌',
                },
            }"
            label-placement="top"
            label-width="auto"
            :show-require-mark="false"
        >
            <n-form-item label="重设密码令牌" path="token">
                <n-input
                    v-model:value="formResetPasswordValue.token"
                    type="textarea"
                    placeholder="请从邮件中获取"
                    rows="8"
                    clearable
                    :style="{ fontFamily: themeVars.fontFamilyMono, wordBreak: 'break-all' }"
                    @keydown.enter="resetPassword"
                ></n-input>
            </n-form-item>
            <n-button
                @click="resetPassword"
                type="primary"
                block
                :loading="loading"
                :disabled="
                    loading
                    || !formResetPasswordValue.token
                "
            >重设密码</n-button>
        </n-form>
        <n-p style="text-align:right">
            <n-a @click="resetPasswordMode = false">返回登录</n-a>
        </n-p>
    </div>
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
        <n-p style="display:flex">
            <n-a @click="registerMode = true; resetPasswordMode = false">注册</n-a>
            <span style="flex-grow:1"></span>
            <n-a @click="registerMode = false; resetPasswordMode = true">忘记密码</n-a>
        </n-p>
    </n-form>
</template>

<script setup lang="ts">
import { NText, useThemeVars } from 'naive-ui';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import VueTurnstile from 'vue-turnstile';
import http, {
    type ApiLogin,
    type ApiRegister,
    type ApiResetPassword,
} from '../request';
import store from '../store';

const router = useRouter();
const themeVars = useThemeVars();

const registerMode = ref(false);
const resetPasswordMode = ref(false);

const captchaLogin = ref<typeof VueTurnstile | null>(null);
const loading = ref(false);
const formLoginValue = reactive({
    username: '',
    password: '',
    captcha: '',
});

const login = async () => {
    if (
        loading.value ||
        !formLoginValue.username ||
        !formLoginValue.password ||
        !formLoginValue.captcha
    )
        return;
    try {
        loading.value = true;
        const r = await http.post(formLoginValue, '/login').json<ApiLogin>();
        store.token = r.token;
        localStorage.setItem('token', store.token);
        window.chiya.message.success('登录成功');
        const route = router.currentRoute.value;
        router.push(
            (Array.isArray(route.query.redirect)
                ? route.query.redirect[0]
                : route.query.redirect) || '/',
        );
    } catch {
    } finally {
        loading.value = false;
        captchaLogin.value?.reset();
    }
};

const captchaRegister = ref<typeof VueTurnstile | null>(null);
const captchaResetPassword = ref<typeof VueTurnstile | null>(null);
const formRegisterTokenValue = reactive({
    username: '',
    email: '',
    captcha: '',
});
const formRegisterValue = reactive({
    token: '',
});
const formPasswordResetTokenValue = reactive({
    username: '',
    email: '',
    captcha: '',
});
const formResetPasswordValue = reactive({
    token: '',
});

const getRegisterToken = async () => {
    if (
        loading.value ||
        !formRegisterTokenValue.username ||
        !formRegisterTokenValue.email ||
        !formRegisterTokenValue.captcha
    )
        return;
    try {
        loading.value = true;
        await http.post(formRegisterTokenValue, '/register-token').res();
        window.chiya.message.success(
            `已向 ${formRegisterTokenValue.email} 发送注册令牌`,
        );
    } catch {
    } finally {
        loading.value = false;
        captchaRegister.value?.reset();
    }
};

const getPasswordResetToken = async () => {
    if (
        loading.value ||
        !formPasswordResetTokenValue.username ||
        !formPasswordResetTokenValue.email ||
        !formPasswordResetTokenValue.captcha
    )
        return;
    try {
        loading.value = true;
        await http
            .post(formPasswordResetTokenValue, '/password-reset-token')
            .res();
        window.chiya.message.success(
            `已向 ${formPasswordResetTokenValue.email} 发送重设密码令牌`,
        );
    } catch {
    } finally {
        loading.value = false;
        captchaResetPassword.value?.reset();
    }
};

const register = async () => {
    if (loading.value || !formRegisterValue.token) return;
    try {
        loading.value = true;
        const r = await http
            .post(formRegisterValue, '/register')
            .json<ApiRegister>();
        window.chiya.dialog.create({
            title: '注册',
            content: () => [
                `已注册新用户 #${r.uid} “${r.username}”，初始密码为 `,
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
        formRegisterValue.token = '';
    } catch {
    } finally {
        loading.value = false;
        captchaRegister.value?.reset();
    }
};

const resetPassword = async () => {
    if (loading.value || !formResetPasswordValue.token) return;
    try {
        loading.value = true;
        const r = await http
            .post(formResetPasswordValue, '/reset-password')
            .json<ApiResetPassword>();
        window.chiya.dialog.create({
            title: '重设密码',
            content: () => [
                `已将用户 #${r.uid} “${r.username}”的密码重设为 `,
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
        formResetPasswordValue.token = '';
    } catch {
    } finally {
        loading.value = false;
        captchaResetPassword.value?.reset();
    }
};
</script>