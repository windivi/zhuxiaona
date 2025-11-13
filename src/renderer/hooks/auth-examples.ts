/**
 * 认证系统集成示例
 * 
 * 展示如何在实际组件中使用认证系统的各种功能
 */

// ==========================================
// 示例 1: 登录界面组件
// ==========================================

/*
<template>
  <div class="login-container">
    <div class="status" :class="loginStatus.class">
      {{ loginStatus.text }}
    </div>
    
    <div class="message">{{ lastMessage }}</div>
    
    <div class="credentials">
      <input 
        v-model="credentials.username" 
        placeholder="用户名"
        :disabled="isLoading"
      />
      <input 
        v-model="credentials.password" 
        placeholder="密码"
        :disabled="isLoading"
        type="password"
      />
      <input 
        v-model="credentials.dynamicCode" 
        placeholder="动态码"
        :disabled="isLoading"
      />
    </div>
    
    <button 
      @click="startAutoLogin" 
      :disabled="isLoading"
      class="login-button"
    >
      {{ isLoading ? '登录中...' : '自动登录' }}
    </button>

    <button 
      @click="initializeAuth" 
      :disabled="isLoading"
      class="init-button"
    >
      初始化认证
    </button>

    <button 
      @click="syncAuthToBackend" 
      :disabled="isLoading"
      class="sync-button"
    >
      同步认证信息
    </button>
  </div>
</template>

<script setup lang="ts">
import { useAutoLogin } from '@/hooks/auto-login'

const {
  authInfo,
  credentials,
  loginStatus,
  lastMessage,
  isLoading,
  initializeAuth,
  startAutoLogin,
  syncAuthToBackend
} = useAutoLogin()
</script>

<style scoped>
.login-container {
  padding: 20px;
  max-width: 400px;
  margin: 0 auto;
}

.status {
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  text-align: center;
  font-weight: bold;
}

.status.status-success {
  background-color: #d4edda;
  color: #155724;
}

.status.status-error {
  background-color: #f8d7da;
  color: #721c24;
}

.status.status-loading {
  background-color: #cce5ff;
  color: #004085;
}

.status.status-none {
  background-color: #e2e3e5;
  color: #383d41;
}

.message {
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 20px;
}

.credentials {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.credentials input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 5px;
  width: 100%;
}

.login-button {
  background-color: #007bff;
  color: white;
}

.init-button {
  background-color: #28a745;
  color: white;
}

.sync-button {
  background-color: #17a2b8;
  color: white;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
*/

// ==========================================
// 示例 2: 数据列表组件（自动处理认证）
// ==========================================

/*
<template>
  <div class="data-list">
    <button @click="fetchData" :disabled="loading">
      {{ loading ? '加载中...' : '刷新数据' }}
    </button>

    <div v-if="error" class="error-message">
      ⚠️ {{ error }}
    </div>

    <div v-if="items.length" class="items">
      <div v-for="item in items" :key="item.id" class="item">
        {{ item.title }}
      </div>
    </div>

    <div v-else-if="!loading" class="empty">
      暂无数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthenticatedRequest } from '@/hooks/useAuthenticatedRequest'

const items = ref<any[]>([])
const { loading, error, get } = useAuthenticatedRequest()

const fetchData = async () => {
  // 自动处理：
  // 1. 添加认证信息到请求头
  // 2. 如果返回 401，自动登录并重试
  // 3. 网络错误时自动重试（最多 3 次）
  const data = await get('/api/activity/list', {
    retryCount: 3,
    retryDelay: 1000
  })

  if (data) {
    items.value = data
  }
}

// 组件挂载时自动加载
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.data-list {
  padding: 20px;
}

button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 10px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  padding: 10px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  margin-bottom: 10px;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  padding: 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.empty {
  text-align: center;
  padding: 20px;
  color: #6c757d;
}
</style>
*/

// ==========================================
// 示例 3: 直接使用 httpClient
// ==========================================

/*
import httpClient from '@/services/http-client'
import { getAuthManager } from '@/services/auth-manager'

// 发送带自动重试的请求
async function fetchUserData() {
  try {
    const userData = await httpClient.get('/api/user/profile', {
      retryCount: 3,      // 最多重试 3 次
      retryDelay: 1000    // 每次延迟 1 秒
    })
    console.log('用户数据:', userData)
  } catch (error) {
    console.error('获取用户数据失败:', error)
  }
}

// 使用 POST 请求
async function submitForm(data: any) {
  try {
    const result = await httpClient.post('/api/form/submit', data, {
      retryCount: 2
    })
    console.log('提交成功:', result)
  } catch (error) {
    console.error('提交失败:', error)
  }
}

// 检查认证状态
function checkAuthStatus() {
  const authManager = getAuthManager()
  const status = authManager.getStatus()
  
  console.log('认证状态:', status)
  // {
  //   isAuthenticated: true,
  //   lastUpdated: 1699851234567,
  //   source: 'login' | 'local' | 'backend'
  // }
}

// 获取认证信息
function getAuthInfo() {
  const authManager = getAuthManager()
  const authInfo = authManager.getAuthInfo()
  
  console.log('Cookies:', authInfo.cookies)
  console.log('CSRF Token:', authInfo.csrfToken)
}

// 手动登录
async function login() {
  const authManager = getAuthManager()
  const success = await authManager.login({
    username: '13272009478',
    password: '13272009478@Hxn',
    dynamicCode: '666666'
  })
  
  if (success) {
    console.log('登录成功')
  } else {
    console.log('登录失败')
  }
}

// 退出登录
async function logout() {
  const authManager = getAuthManager()
  await authManager.logout()
  console.log('已退出登录')
}
*/

// ==========================================
// 示例 4: 错误处理和恢复
// ==========================================

/*
async function robustDataFetch() {
  const { get, error } = useAuthenticatedRequest()
  
  // 尝试获取数据，带自动恢复
  const data = await get('/api/data', {
    retryCount: 5,
    retryDelay: 1000
  })

  if (error.value) {
    // 检查是什么类型的错误
    if (error.value.includes('401')) {
      console.log('认证失败 - 可能需要手动重新登录')
      // showLoginDialog()
    } else if (error.value.includes('超时')) {
      console.log('请求超时 - 请检查网络连接')
    } else {
      console.log('其他错误:', error.value)
    }
  } else if (data) {
    console.log('数据获取成功:', data)
  }
}

// 带降级处理的获取
async function fetchWithFallback() {
  const { get } = useAuthenticatedRequest()
  
  try {
    // 先尝试从服务器获取
    const data = await get('/api/data', { retryCount: 2 })
    if (data) return data
  } catch (error) {
    console.warn('网络请求失败，尝试使用缓存')
  }

  // 降级到本地缓存
  const cached = localStorage.getItem('data-cache')
  if (cached) {
    console.log('使用缓存数据')
    return JSON.parse(cached)
  }

  return null
}
*/

export const examples = {
  note: '这个文件中的示例代码都被注释了，用于参考。请复制到你的组件中使用。'
}
