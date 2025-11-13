/**
 * 认证系统初始化 - 应用启动时调用
 * 
 * 设置流程：
 * 1. 初始化 AuthManager（本地 + 后端）
 * 2. 配置 axios 拦截器
 * 3. 处理 401 错误的自动重试
 */

import axios from 'axios'
import { getAuthManager } from './auth-manager'
import { setupAuthInterceptor } from './auth-interceptor'

/**
 * 初始化认证系统
 */
export async function initializeAuthSystem(credentials: {
    username: string
    password: string
    dynamicCode: string
}) {
    console.log('[Auth] 开始初始化认证系统...')

    try {
        const authManager = getAuthManager()

        // 步骤 1: 初始化认证信息
        const authInfo = await authManager.initialize(credentials)
        
        if (!authInfo) {
            console.warn('[Auth] 无法获取有效的认证信息，需要手动登录')
            return false
        }

        console.log('[Auth] 认证信息已初始化')

        // 步骤 2: 配置 axios 拦截器
        setupAuthInterceptor(
            axios,
            // 自动登录处理函数
            async () => {
                console.log('[Auth] 触发自动登录...')
                return await authManager.login(credentials)
            },
            // 获取认证信息函数
            async () => {
                return authManager.getAuthInfo()
            }
        )

        console.log('[Auth] 认证系统初始化完成')
        return true
    } catch (error) {
        console.error('[Auth] 认证系统初始化失败:', error)
        return false
    }
}

/**
 * 检查认证信息是否有效
 */
export async function checkAuthStatus(): Promise<boolean> {
    const authManager = getAuthManager()
    return await authManager.validate()
}

/**
 * 获取认证信息
 */
export function getAuthInfo() {
    const authManager = getAuthManager()
    return authManager.getAuthInfo()
}

/**
 * 手动登录
 */
export async function login(credentials: {
    username: string
    password: string
    dynamicCode: string
}): Promise<boolean> {
    const authManager = getAuthManager()
    return await authManager.login(credentials)
}

/**
 * 退出登录
 */
export async function logout(): Promise<boolean> {
    const authManager = getAuthManager()
    return await authManager.logout()
}

export { getAuthManager }
