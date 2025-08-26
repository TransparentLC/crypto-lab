<template>
    <n-h2>修改密码</n-h2>
    <n-form
        :model="formChangePasswordValue"
        :rules="{
            oldPassword: {
                required: true,
                trigger: 'blur',
                message: '请输入旧密码',
            },
            newPassword: {
                required: true,
                trigger: 'blur',
                message: '请输入新密码',
            },
            newPasswordRepeat: {
                required: true,
                trigger: ['input', 'blur'],
                message: '两次输入密码不一致',
                validator: (_, value: string) => value === formChangePasswordValue.newPassword,
            },
        }"
        label-placement="top"
        label-width="auto"
        :show-require-mark="false"
        style="max-width:480px"
    >
        <n-form-item label="旧密码" path="oldPassword">
            <n-input
                v-model:value="formChangePasswordValue.oldPassword"
                type="password"
                show-password-on="mousedown"
                placeholder=""
                @keydown.enter="changePassword"
            ></n-input>
        </n-form-item>
        <n-form-item label="新密码" path="newPassword">
            <n-input
                v-model:value="formChangePasswordValue.newPassword"
                type="password"
                show-password-on="mousedown"
                placeholder=""
                @keydown.enter="changePassword"
            ></n-input>
        </n-form-item>
        <n-form-item label="再输一遍" path="newPasswordRepeat">
            <n-input
                v-model:value="formChangePasswordValue.newPasswordRepeat"
                type="password"
                show-password-on="mousedown"
                placeholder=""
                @keydown.enter="changePassword"
            ></n-input>
        </n-form-item>
        <n-p>
            <n-space>
                <n-button
                    @click="changePassword"
                    type="primary"
                    :loading="changePasswordLoading"
                    :disabled="
                        changePasswordLoading
                        || !formChangePasswordValue.oldPassword
                        || !formChangePasswordValue.newPassword
                        || formChangePasswordValue.newPassword !== formChangePasswordValue.newPasswordRepeat
                    "
                >修改密码</n-button>
            </n-space>
        </n-p>
    </n-form>
    <n-divider></n-divider>
    <n-p>
        <n-space>
            <n-button @click="logout" primary type="error">退出登录</n-button>
        </n-space>
    </n-p>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import http from '../request.js';
import store from '../store.js';

const router = useRouter();

const changePasswordLoading = ref(false);
const formChangePasswordValue = reactive({
    oldPassword: '',
    newPassword: '',
    newPasswordRepeat: '',
});

const changePassword = async () => {
    try {
        changePasswordLoading.value = true;
        await http
            .post(
                {
                    oldPassword: formChangePasswordValue.oldPassword,
                    newPassword: formChangePasswordValue.newPassword,
                },
                '/change-password',
            )
            .res();
        window.chiya.message.success('修改成功');
        formChangePasswordValue.oldPassword =
            formChangePasswordValue.newPassword =
            formChangePasswordValue.newPasswordRepeat =
                '';
    } catch {
    } finally {
        changePasswordLoading.value = false;
    }
};

const logout = () =>
    window.chiya.dialog.create({
        title: '退出登录',
        content: '是否确定要退出登录？',
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: () => {
            localStorage.removeItem('token');
            store.token = '';
            router.push('/');
        },
    });
</script>