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
        // 1. 检查前端本地存储
        if (window.electronAPI) {
            const localAuth = JSON.parse(localStorage.getItem('auth-info') || '{}')
            if (localAuth.cookies && localAuth.csrfToken) {
                // 前端有认证信息，验证有效性
                if (await this.validateAuthInfo(localAuth)) {
                    console.log('[Auth] 前端认证信息有效')
                    return true
                }
            }
        }

        // 2. 尝试从后端获取
        try {
            const backendAuth = await window.electronAPI.getAuthInfo()
            if (backendAuth.cookies && backendAuth.csrfToken) {
                console.log('[Auth] 从后端恢复认证信息')
                localStorage.setItem('auth-info', JSON.stringify(backendAuth))
                return true
            }
        } catch (error) {
            console.log('[Auth] 后端无认证信息')
        }

        // 3. 都没有，发起自动登录
        return await this.autoLoginWithSync(credentials)
    }

    /**
     * 验证认证信息是否有效
     * 通过发送一个测试请求来验证
     */
    private async validateAuthInfo(authInfo: any): Promise<boolean> {
        try {
            // 使用一个简单的API调用来验证
            const response = await axios.get(
                'https://sxzy.chasinggroup.com/admin/marketing/display/audit',
                {
                    headers: {
                        'cookie': authInfo.cookies,
                        'x-csrf-token': authInfo.csrfToken
                    },
                    timeout: 5000
                }
            )
            return response.status === 200
        } catch (error: any) {
            // 401 表示认证失败，其他错误可能是网络问题
            if (error.response?.status === 401) {
                return false
            }
            // 网络问题时，假设认证信息有效
            return true
        }
    }

    /**
     * 自动登录并同步前后端认证信息
     */
    async autoLoginWithSync(credentials: any): Promise<boolean> {
        // 防止并发登录请求
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
                    
                    // 前端存储
                    localStorage.setItem('auth-info', JSON.stringify(authData))
                    
                    // 后端同步
                    try {
                        await window.electronAPI.setAuthInfo(authData)
                        console.log('[Auth] 前后端认证信息同步完成')
                    } catch (error) {
                        console.warn('[Auth] 后端同步失败:', error)
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
    const testApi = 'https://sxzy.chasinggroup.com/admin/marketing/display/audit'
    const authInfo = useStorage('auth-info', {
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

    // 方法：启动智能认证流程
    const initializeAuth = async () => {
        isLoading.value = true
        loginStatus.value = { text: '初始化认证...', class: 'status-loading' }
        lastMessage.value = '检查认证信息...'

        try {
            const success = await authManager.checkAndRestoreAuth(credentials.value)
            
            if (success) {
                // 尝试获取最新的认证信息
                const latestAuth = await window.electronAPI.getAuthInfo()
                authInfo.value = {
                    cookies: latestAuth.cookies || '',
                    csrfToken: latestAuth.csrfToken || ''
                }
                loginStatus.value = { text: '认证成功', class: 'status-success' }
                lastMessage.value = '认证信息已就绪'
                return true
            } else {
                loginStatus.value = { text: '认证失败', class: 'status-error' }
                lastMessage.value = '无法获取有效的认证信息'
                return false
            }
        } catch (error) {
            loginStatus.value = { text: '初始化错误', class: 'status-error' }
            lastMessage.value = error instanceof Error ? error.message : '未知错误'
            console.error('认证初始化失败:', error)
            return false
        } finally {
            isLoading.value = false
        }
    }

    // 方法：手动启动自动登录
    const startAutoLogin = async () => {
        isLoading.value = true
        loginStatus.value = { text: '登录中...', class: 'status-loading' }
        lastMessage.value = '正在启动自动登录...'

        try {
            const success = await authManager.autoLoginWithSync(credentials.value)

            if (success) {
                loginStatus.value = { text: '登录成功', class: 'status-success' }
                const latestAuth = await window.electronAPI.getAuthInfo()
                authInfo.value = {
                    cookies: latestAuth.cookies || '',
                    csrfToken: latestAuth.csrfToken || ''
                }
                lastMessage.value = '登录并同步完成'
                authManager.resetRetryCount()
            } else {
                loginStatus.value = { text: '登录失败', class: 'status-error' }
                lastMessage.value = '自动登录失败'
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

    // 方法：同步认证信息到后端
    const syncAuthToBackend = async () => {
        isLoading.value = true
        try {
            const result = await window.electronAPI.setAuthInfo({
                cookies: authInfo.value.cookies,
                csrfToken: authInfo.value.csrfToken
            })

            if (result.success) {
                lastMessage.value = '认证信息已同步到后端'
                console.log('[Auth] 认证信息同步成功')
            }
        } catch (error) {
            lastMessage.value = error instanceof Error ? error.message : '同步失败'
            console.error('同步认证信息失败:', error)
        } finally {
            isLoading.value = false
        }
    }

    // 方法：处理401错误（由axios拦截器调用）
    const handleAuthError = async () => {
        try {
            const success = await authManager.handle401Error(credentials.value)
            if (success) {
                const latestAuth = await window.electronAPI.getAuthInfo()
                authInfo.value = {
                    cookies: latestAuth.cookies || '',
                    csrfToken: latestAuth.csrfToken || ''
                }
                lastMessage.value = '认证错误已恢复'
            }
            return success
        } catch (error) {
            console.error('处理认证错误失败:', error)
            return false
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

    return {
        authInfo,
        credentials,
        loginStatus,
        lastMessage,
        isLoading,
        initializeAuth,
        startAutoLogin,
        getAuthInfo,
        syncAuthToBackend,
        handleAuthError,
        authManager
    }
}
