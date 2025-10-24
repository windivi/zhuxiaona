<template>
  <div class="auto-login-panel">
    <h3>自动登录控制面板</h3>
    
    <div class="form-section">
      <div class="form-group">
        <label>用户名:</label>
        <input 
          v-model="credentials.username" 
          type="text" 
          placeholder="请输入用户名"
          :disabled="isLoading"
        />
      </div>
      
      <div class="form-group">
        <label>密码:</label>
        <input 
          v-model="credentials.password" 
          type="password" 
          placeholder="请输入密码"
          :disabled="isLoading"
        />
      </div>
      
      <div class="form-group">
        <label>动态码:</label>
        <input 
          v-model="credentials.dynamicCode" 
          type="text" 
          placeholder="请输入6位动态码"
          maxlength="6"
          :disabled="isLoading"
        />
      </div>
      
      <div class="button-group">
        <button 
          @click="startAutoLogin" 
          :disabled="isLoading || !isFormValid"
          class="btn btn-primary"
        >
          {{ isLoading ? '登录中...' : '开始自动登录' }}
        </button>
        
        <button 
          @click="getAuthInfo" 
          :disabled="isLoading"
          class="btn btn-secondary"
        >
          获取认证信息
        </button>
        
        <button 
          @click="closeBrowser" 
          :disabled="isLoading"
          class="btn btn-danger"
        >
          关闭浏览器
        </button>
      </div>
    </div>
    
    <div class="status-section">
      <h4>状态信息</h4>
      <div class="status-item">
        <strong>登录状态:</strong> 
        <span :class="loginStatus.class">{{ loginStatus.text }}</span>
      </div>
      
      <div v-if="authInfo.cookies" class="auth-info">
        <div class="info-item">
          <strong>Cookies:</strong>
          <div class="cookie-display">{{ authInfo.cookies }}</div>
        </div>
        
        <div class="info-item">
          <strong>CSRF Token:</strong>
          <div class="token-display">{{ authInfo.csrfToken || '未获取到' }}</div>
        </div>
      </div>
      
      <div v-if="lastMessage" class="message">
        <strong>消息:</strong> {{ lastMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 响应式数据
const credentials = ref({
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
      
      // 清空动态码，因为它通常是一次性的
      credentials.value.dynamicCode = ''
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
  margin: 20px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f9f9f9;
}

.form-section {
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.status-section {
  border-top: 1px solid #ddd;
  padding-top: 20px;
}

.status-item {
  margin-bottom: 15px;
}

.status-none {
  color: #6c757d;
}

.status-loading {
  color: #007bff;
}

.status-success {
  color: #28a745;
}

.status-error {
  color: #dc3545;
}

.auth-info {
  margin-top: 15px;
}

.info-item {
  margin-bottom: 10px;
}

.cookie-display, .token-display {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  max-height: 100px;
  overflow-y: auto;
}

.message {
  margin-top: 15px;
  padding: 10px;
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  font-size: 14px;
}
</style>