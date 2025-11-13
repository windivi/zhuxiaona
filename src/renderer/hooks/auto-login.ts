import { useStorage } from "@vueuse/core"
import axios from "axios"
import { onMounted, ref } from "vue"

// 认证管理类 - 处理认证信息的同步和有效性验证
class AuthManager {
    private retryCount = 0
    private maxRetries = 2
    private isLoggingIn = false
    private loginPromise: Promise<boolean> | null = null

    async checkAndRestoreAuth(credentials: any) {
        // 从主进程获取认证信息（主进程会从磁盘加载）
        try {
            const backendAuth = await window.electronAPI.getAuthInfo()
            if (backendAuth.cookies && backendAuth.csrfToken) {
                console.log('[Auth] 从主进程恢复认证信息')
                return true
            }
        } catch (error) {
            console.log('[Auth] 主进程无认证信息')
        }

        // 都没有，发起自动登录
        return await this.autoLoginWithSync(credentials)
    }

    /**
     * 自动登录并同步到主进程
     */
    async autoLoginWithSync(credentials: any): Promise<boolean> {
        if (this.isLoggingIn && this.loginPromise) {
            return this.loginPromise
        }

        this.isLoggingIn = true
        this.loginPromise = (async () => {
            try {
                console.log('[Auth] 发起自动登录...')
                const result = await window.electronAPI.autoLogin(credentials)

                if (result.success) {
                    const authData = {
                        cookies: result.cookies || '',
                        csrfToken: result.csrfToken || ''
                    }
                    this.retryCount = 0
                    return true
                } else {
                    console.error('[Auth] 自动登录失败:', result.message)
                    return false
                }
            } catch (error) {
                console.error('[Auth] 自动登录异常:', error)
                return false
            } finally {
                this.isLoggingIn = false
                this.loginPromise = null
                window.electronAPI.closeBrowserAutomation()
            }
        })()

        return this.loginPromise
    }

    /**
     * 处理401错误 - 自动重试登录
     */
    async handle401Error(credentials: any): Promise<boolean> {
        if (this.retryCount >= this.maxRetries) {
            console.error('[Auth] 达到最大重试次数')
            return false
        }

        this.retryCount++
        console.log(`[Auth] 处理401错误，尝试自动登录 (${this.retryCount}/${this.maxRetries})`)

        return await this.autoLoginWithSync(credentials)
    }

    resetRetryCount() {
        this.retryCount = 0
    }
}

export function useAutoLogin() {
    // 认证信息从主进程读取，不需要存储到 localStorage
    const authInfo = ref({
        cookies: '',
        csrfToken: ''
    })
    const credentials = useStorage('account-info', {
        username: '13272009478',
        password: '13272009478@Hxn',
        dynamicCode: '666666'
    })
    const isLoading = ref(false)
    const loginStatus = ref({
        text: '未登录',
        class: 'status-none'
    })
    const lastMessage = ref('')
    const authManager = new AuthManager()

    // 方法：获取认证信息（从后端同步）
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

    return {
        authInfo,
        credentials,
        loginStatus,
        lastMessage,
        getAuthInfo,
        authManager
    }
}
