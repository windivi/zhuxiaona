/**
 * 认证管理工具类 - 统一处理认证相关的业务逻辑
 * 
 * 功能：
 * 1. 本地存储管理（localStorage）
 * 2. 后端同步（IPC 通信）
 * 3. 认证信息的验证和刷新
 * 4. 自动重试机制
 */

export interface AuthInfo {
    cookies: string
    csrfToken: string
}

export interface AuthStatus {
    isAuthenticated: boolean
    lastUpdated: number
    source: 'local' | 'backend' | 'login' | 'unknown'
}

class AuthStore {
    private static STORAGE_KEY = 'auth-info'
    private static STATUS_KEY = 'auth-status'

    /**
     * 获取本地存储的认证信息
     */
    static getLocal(): AuthInfo {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY)
            return data ? JSON.parse(data) : { cookies: '', csrfToken: '' }
        } catch (error) {
            console.error('[AuthStore] 读取本地认证信息失败:', error)
            return { cookies: '', csrfToken: '' }
        }
    }

    /**
     * 保存认证信息到本地
     */
    static saveLocal(authInfo: AuthInfo) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authInfo))
            this.updateStatus({ isAuthenticated: true, source: 'local' })
        } catch (error) {
            console.error('[AuthStore] 保存本地认证信息失败:', error)
        }
    }

    /**
     * 清除本地认证信息
     */
    static clearLocal() {
        localStorage.removeItem(this.STORAGE_KEY)
        this.updateStatus({ isAuthenticated: false, source: 'unknown' })
    }

    /**
     * 更新认证状态
     */
    static updateStatus(status: Partial<AuthStatus>) {
        try {
            const current = this.getStatus()
            const updated = {
                ...current,
                ...status,
                lastUpdated: Date.now()
            }
            localStorage.setItem(this.STATUS_KEY, JSON.stringify(updated))
        } catch (error) {
            console.error('[AuthStore] 更新认证状态失败:', error)
        }
    }

    /**
     * 获取认证状态
     */
    static getStatus(): AuthStatus {
        try {
            const data = localStorage.getItem(this.STATUS_KEY)
            return data ? JSON.parse(data) : {
                isAuthenticated: false,
                lastUpdated: 0,
                source: 'unknown'
            }
        } catch (error) {
            return {
                isAuthenticated: false,
                lastUpdated: 0,
                source: 'unknown'
            }
        }
    }

    /**
     * 检查认证信息是否有效（5分钟内视为有效）
     */
    static isValid(): boolean {
        const status = this.getStatus()
        if (!status.isAuthenticated) return false

        const expiryTime = 5 * 60 * 1000 // 5 minutes
        return (Date.now() - status.lastUpdated) < expiryTime
    }
}

/**
 * 认证管理类
 */
export class AuthManager {
    private retryCount = 0
    private maxRetries = 2
    private isLoggingIn = false
    private loginPromise: Promise<boolean> | null = null

    /**
     * 初始化认证流程（应用启动时调用）
     */
    async initialize(credentials: {
        username: string
        password: string
        dynamicCode: string
    }): Promise<AuthInfo | null> {
        console.log('[AuthManager] 初始化认证流程...')

        // 1. 检查本地存储
        const localAuth = AuthStore.getLocal()
        if (localAuth.cookies && localAuth.csrfToken) {
            if (AuthStore.isValid()) {
                console.log('[AuthManager] 本地认证信息有效')
                return localAuth
            }
        }

        // 2. 尝试从后端获取
        try {
            const backendAuth = await window.electronAPI.getAuthInfo()
            if (backendAuth.cookies && backendAuth.csrfToken) {
                console.log('[AuthManager] 从后端恢复认证信息')
                AuthStore.saveLocal(backendAuth)
                AuthStore.updateStatus({ isAuthenticated: true, source: 'backend' })
                return backendAuth
            }
        } catch (error) {
            console.log('[AuthManager] 后端无认证信息:', error)
        }

        // 3. 都没有，发起自动登录
        console.log('[AuthManager] 开始自动登录...')
        const success = await this.login(credentials)
        
        if (success) {
            const auth = AuthStore.getLocal()
            AuthStore.updateStatus({ isAuthenticated: true, source: 'login' })
            return auth
        }

        return null
    }

    /**
     * 执行自动登录
     */
    async login(credentials: {
        username: string
        password: string
        dynamicCode: string
    }): Promise<boolean> {
        // 防止并发登录
        if (this.isLoggingIn && this.loginPromise) {
            return this.loginPromise
        }

        this.isLoggingIn = true
        this.loginPromise = this._login(credentials)

        try {
            return await this.loginPromise
        } finally {
            this.isLoggingIn = false
            this.loginPromise = null
        }
    }

    /**
     * 实际的登录逻辑
     */
    private async _login(credentials: {
        username: string
        password: string
        dynamicCode: string
    }): Promise<boolean> {
        try {
            console.log('[AuthManager] 执行自动登录...')
            const result = await window.electronAPI.autoLogin(credentials)

            if (result.success) {
                const authData: AuthInfo = {
                    cookies: result.cookies || '',
                    csrfToken: result.csrfToken || ''
                }

                // 本地存储
                AuthStore.saveLocal(authData)

                // 后端同步
                try {
                    await window.electronAPI.setAuthInfo(authData)
                    console.log('[AuthManager] 认证信息已同步到后端')
                } catch (syncError) {
                    console.warn('[AuthManager] 后端同步失败:', syncError)
                }

                this.resetRetries()
                return true
            } else {
                console.error('[AuthManager] 自动登录失败:', result.message)
                return false
            }
        } catch (error) {
            console.error('[AuthManager] 登录异常:', error)
            return false
        }
    }

    /**
     * 处理 401 错误 - 自动重试登录
     */
    async handle401(credentials: {
        username: string
        password: string
        dynamicCode: string
    }): Promise<boolean> {
        if (this.retryCount >= this.maxRetries) {
            console.error('[AuthManager] 达到最大重试次数，放弃登录')
            AuthStore.clearLocal()
            return false
        }

        this.retryCount++
        console.log(`[AuthManager] 处理 401 错误，第 ${this.retryCount}/${this.maxRetries} 次重试...`)

        return await this.login(credentials)
    }

    /**
     * 重置重试计数
     */
    private resetRetries() {
        this.retryCount = 0
    }

    /**
     * 手动设置认证信息
     */
    async setAuthInfo(authInfo: AuthInfo): Promise<boolean> {
        try {
            // 本地保存
            AuthStore.saveLocal(authInfo)

            // 后端同步
            const result = await window.electronAPI.setAuthInfo(authInfo)
            
            if (result.success) {
                AuthStore.updateStatus({ isAuthenticated: true, source: 'local' })
                return true
            }
            return false
        } catch (error) {
            console.error('[AuthManager] 设置认证信息失败:', error)
            return false
        }
    }

    /**
     * 获取当前认证信息
     */
    getAuthInfo(): AuthInfo {
        return AuthStore.getLocal()
    }

    /**
     * 获取认证状态
     */
    getStatus(): AuthStatus {
        return AuthStore.getStatus()
    }

    /**
     * 退出登录
     */
    async logout(): Promise<boolean> {
        try {
            AuthStore.clearLocal()
            // 尝试通知后端清除认证
            try {
                await window.electronAPI.setAuthInfo({ cookies: '', csrfToken: '' })
            } catch (error) {
                console.warn('[AuthManager] 后端注销失败:', error)
            }
            return true
        } catch (error) {
            console.error('[AuthManager] 退出登录失败:', error)
            return false
        }
    }

    /**
     * 验证认证信息是否仍然有效
     */
    async validate(): Promise<boolean> {
        const authInfo = AuthStore.getLocal()
        
        if (!authInfo.cookies || !authInfo.csrfToken) {
            return false
        }

        // 从后端再次验证
        try {
            const backendAuth = await window.electronAPI.getAuthInfo()
            return !!backendAuth.cookies && !!backendAuth.csrfToken
        } catch (error) {
            console.error('[AuthManager] 验证认证信息失败:', error)
            return false
        }
    }
}

/**
 * 创建单例实例
 */
let authManager: AuthManager | null = null

export function getAuthManager(): AuthManager {
    if (!authManager) {
        authManager = new AuthManager()
    }
    return authManager
}

/**
 * 重置认证管理器（用于测试）
 */
export function resetAuthManager() {
    authManager = null
}
