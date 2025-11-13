/**
 * 认证管理工具类 - 简化版本
 * 认证数据由主进程持久化管理，前端仅负责读取和业务逻辑
 */

export interface AuthInfo {
    cookies: string
    csrfToken: string
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

        // 尝试从主进程获取（主进程会从磁盘加载）
        try {
            const backendAuth = await window.electronAPI.getAuthInfo()
            if (backendAuth.cookies && backendAuth.csrfToken) {
                console.log('[AuthManager] 从主进程恢复认证信息')
                return backendAuth
            }
        } catch (error) {
            console.log('[AuthManager] 主进程无认证信息:', error)
        }

        // 都没有，发起自动登录
        console.log('[AuthManager] 开始自动登录...')
        const success = await this.login(credentials)
        
        if (success) {
            const auth = await window.electronAPI.getAuthInfo()
            return auth
        }

        return null
    }

    /**
     * 执行登录
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
     * 获取当前认证信息
     */
    async getAuthInfo(): Promise<AuthInfo> {
        try {
            return await window.electronAPI.getAuthInfo()
        } catch (error) {
            console.error('[AuthManager] 获取认证信息失败:', error)
            return { cookies: '', csrfToken: '' }
        }
    }

    /**
     * 验证认证信息是否仍然有效
     */
    async validate(): Promise<boolean> {
        try {
            const authInfo = await window.electronAPI.getAuthInfo()
            return !!authInfo.cookies && !!authInfo.csrfToken
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
