<template>
	<a-card class="auto-login-panel" bordered>
		<template #title>
			<span>自动登录</span>
		</template>

		<a-form layout="vertical" class="form-section">
			<!-- <a-form-item label="用户名">
				<a-input v-model:value="credentials.username" :disabled="isLoading" placeholder="请输入用户名" />
			</a-form-item>

			<a-form-item label="密码">
				<a-input-password v-model:value="credentials.password" :disabled="isLoading" placeholder="请输入密码" />
			</a-form-item>

			<a-form-item label="动态码">
				<a-input v-model:value="credentials.dynamicCode" :disabled="isLoading" :maxlength="6"
					placeholder="请输入6位动态码" />
			</a-form-item> -->

			<a-form-item>
				<a-space>
					<a-button type="primary" :loading="isLoading" :disabled="!isFormValid" @click="startAutoLogin">
						{{ isLoading ? '登录中...' : '开始自动登录' }}
					</a-button>

					<!-- <a-button @click="getAuthInfo" :disabled="isLoading">获取认证信息</a-button> -->

					<!-- <a-button danger @click="closeBrowser" :disabled="isLoading">关闭浏览器</a-button> -->
				</a-space>
			</a-form-item>
		</a-form>

		<a-divider />

		<div class="status-section">
			<!-- <a-typography-title :level="5">状态信息</a-typography-title> -->

			<!-- <div class="status-item">
				<strong>登录状态:</strong>
				<a-tag :color="loginTagColor">{{ loginStatus.text }}</a-tag>
			</div> -->

			<!-- <div v-if="authInfo.cookies" class="auth-info">
				<a-descriptions :column="1" bordered>
					<a-descriptions-item label="Cookies">
						<div class="cookie-display">{{ authInfo.cookies }}</div>
					</a-descriptions-item>
					<a-descriptions-item label="CSRF Token">
						<div class="token-display">{{ authInfo.csrfToken || '未获取到' }}</div>
					</a-descriptions-item>
				</a-descriptions>
			</div> -->

			<div v-if="lastMessage" class="message">
				<a-alert show-icon type="info" :message="lastMessage" />
			</div>
		</div>
	</a-card>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { ref, computed, nextTick } from 'vue'

// 响应式数据
const credentials = useStorage('account-info', {
	username: '13272009478',
	password: '13272009478@Hxn',
	dynamicCode: '666666'
})

const isLoading = ref(false)
const authInfo = ref({
	cookies: '',
	csrfToken: ''
})

const loginStatus = ref({
	text: '未登录',
	class: 'status-none'
})

const lastMessage = ref('')

// 计算属性
const isFormValid = computed(() => {
	return credentials.value.username &&
		credentials.value.password &&
		credentials.value.dynamicCode.length === 6
})

// tag 颜色映射
const loginTagColor = computed(() => {
	const cls = loginStatus.value.class;
	switch (cls) {
		case 'status-loading':
			return '#1890ff';
		case 'status-success':
			return '#52c41a';
		case 'status-error':
			return '#f5222d';
		case 'status-none':
		default:
			return undefined;
	}
})

// 方法
const startAutoLogin = async () => {
	if (!isFormValid.value) {
		lastMessage.value = '请填写完整的登录信息'
		return
	}

	isLoading.value = true
	loginStatus.value = { text: '登录中...', class: 'status-loading' }
	lastMessage.value = '正在启动自动登录...'

	try {
		const result = await window.electronAPI.autoLogin({
			username: credentials.value.username,
			password: credentials.value.password,
			dynamicCode: credentials.value.dynamicCode
		})

		if (result.success) {
			loginStatus.value = { text: '登录成功', class: 'status-success' }
			authInfo.value = {
				cookies: result.cookies || '',
				csrfToken: result.csrfToken || ''
			}
			lastMessage.value = result.message
		} else {
			loginStatus.value = { text: '登录失败', class: 'status-error' }
			lastMessage.value = result.message
		}
	} catch (error) {
		loginStatus.value = { text: '登录错误', class: 'status-error' }
		lastMessage.value = error instanceof Error ? error.message : '未知错误'
		console.error('自动登录失败:', error)
	} finally {
		isLoading.value = false
		closeBrowser()
	}
}

const getAuthInfo = async () => {
	isLoading.value = true
	try {
		const result = await window.electronAPI.getAuthInfo()
		authInfo.value = result
		lastMessage.value = '认证信息已更新'

		if (result.cookies) {
			loginStatus.value = { text: '已有认证信息', class: 'status-success' }
		} else {
			loginStatus.value = { text: '无认证信息', class: 'status-none' }
		}
	} catch (error) {
		lastMessage.value = error instanceof Error ? error.message : '获取认证信息失败'
		console.error('获取认证信息失败:', error)
	} finally {
		isLoading.value = false
	}
}

const closeBrowser = async () => {
	isLoading.value = true
	try {
		const result = await window.electronAPI.closeBrowserAutomation()
		lastMessage.value = result.message
	} catch (error) {
		lastMessage.value = error instanceof Error ? error.message : '关闭浏览器失败'
		console.error('关闭浏览器失败:', error)
	} finally {
		isLoading.value = false
	}
}

// 组件挂载时获取当前认证信息
getAuthInfo()
</script>

<style scoped>
.auto-login-panel {
	max-width: 1266px;
	width: 100%;
	align-self: center;
	margin: auto;
}

.status-section {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.form-section {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.status-item {
	display: flex;
	align-items: center;
	gap: 8px;
}
</style>