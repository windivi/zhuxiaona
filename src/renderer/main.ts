import { createApp } from 'vue'
import './style.css';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue'
import { initializeAuthSystem } from './services/auth-init'
import httpClient from './services/http-client'

// 初始化认证系统
async function bootstrap() {
    // 获取凭证信息
    const credentials = {
        username: localStorage.getItem('username') || '13272009478',
        password: localStorage.getItem('password') || '13272009478@Hxn',
        dynamicCode: localStorage.getItem('dynamicCode') || '666666'
    }

    // 设置 HTTP 客户端的凭证信息
    // httpClient.setCredentials(credentials)

    // 初始化认证系统（包括 IPC 通信和 axios 拦截器）
    const authInitialized = await initializeAuthSystem(credentials)
    
    if (!authInitialized) {
        console.warn('[App] 认证系统初始化失败，但应用仍将继续启动')
    }

    // 创建并挂载应用
    const app = createApp(App);
    app.mount('#app');
}

bootstrap().catch(error => {
    console.error('[App] 应用启动失败:', error)
})
