/**
 * axios 请求拦截器 - 处理认证信息和 401 错误自动重试
 * 
 * 功能：
 * 1. 自动添加 cookie 和 csrf-token 到请求头
 * 2. 检测 401 错误时自动触发登录重试
 * 3. 记录请求失败信息用于调试
 */

import axios, { AxiosInstance, AxiosError } from 'axios'

interface FailedRequest {
    config: any
    resolve: (value: any) => void
    reject: (error: any) => void
}

class AuthInterceptor {
    private instance: AxiosInstance
    private failedRequests: FailedRequest[] = []
    private isRefreshing = false
    private autoLoginHandler: (() => Promise<boolean>) | null = null
    private getAuthInfo: (() => Promise<{ cookies: string; csrfToken: string }>) | null = null

    constructor(instance: AxiosInstance) {
        this.instance = instance
        this.setupInterceptors()
    }

    /**
     * 设置拦截器
     */
    private setupInterceptors() {
        // 请求拦截器 - 添加认证信息
        this.instance.interceptors.request.use(
            (config: any) => {
                return this.onRequest(config)
            },
            error => Promise.reject(error)
        )

        // 响应拦截器 - 处理 401 错误
        this.instance.interceptors.response.use(
            response => response,
            error => this.onResponseError(error)
        )
    }

    /**
     * 请求拦截处理
     */
    private onRequest(config: any) {
        // 注意：在 Electron 渲染进程中，axios 无法直接设置 cookie 头
        // 因为浏览器 API 出于安全考虑禁止了这一行为
        // 认证信息由 Electron 主进程的 webRequest 拦截器统一处理
        
        // 仅作为备份，如果 IPC 获取到 CSRF token，添加到请求头
        if (this.getAuthInfo) {
            this.getAuthInfo().then(authData => {
                if (authData.csrfToken) {
                    config.headers = config.headers || {}
                    config.headers['x-csrf-token'] = authData.csrfToken
                }
            }).catch(err => {
                console.warn('[AuthInterceptor] 获取认证信息失败:', err)
            })
        }

        return config
    }

    /**
     * 响应错误处理
     */
    private async onResponseError(error: AxiosError) {
        const config = error.config

        // 只处理 401 错误
        if (error.response?.status === 401 && config) {
            // 如果正在刷新，将当前请求加入队列
            if (this.isRefreshing) {
                return new Promise((resolve, reject) => {
                    this.failedRequests.push({
                        config,
                        resolve,
                        reject
                    })
                })
            }

            this.isRefreshing = true

            try {
                // 调用自动登录
                if (this.autoLoginHandler) {
                    const success = await this.autoLoginHandler()

                    if (success) {
                        // 重试失败的请求
                        this.retryFailedRequests()
                        
                        // 用新的认证信息重试当前请求
                        return this.instance(config)
                    } else {
                        console.error('[Auth] 自动登录失败，无法恢复认证')
                        this.failedRequests = []
                        return Promise.reject(error)
                    }
                } else {
                    console.warn('[Auth] autoLoginHandler 未设置')
                    return Promise.reject(error)
                }
            } catch (err) {
                console.error('[Auth] 处理 401 错误时发生异常:', err)
                this.failedRequests = []
                return Promise.reject(err)
            } finally {
                this.isRefreshing = false
            }
        }

        // 其他错误直接返回
        return Promise.reject(error)
    }

    /**
     * 重试所有失败的请求
     */
    private retryFailedRequests() {
        const requests = this.failedRequests
        this.failedRequests = []

        requests.forEach(({ config, resolve, reject }) => {
            this.instance(config)
                .then(response => resolve(response))
                .catch(error => reject(error))
        })
    }

    /**
     * 注册自动登录处理函数
     */
    setAutoLoginHandler(handler: () => Promise<boolean>) {
        this.autoLoginHandler = handler
    }

    /**
     * 注册获取认证信息的函数
     */
    setGetAuthInfoHandler(handler: () => Promise<{ cookies: string; csrfToken: string }>) {
        this.getAuthInfo = handler
    }
}

// 创建全局的 axios 实例和拦截器
let authInterceptor: AuthInterceptor | null = null

/**
 * 初始化 axios 拦截器
 */
export function setupAuthInterceptor(
    instance: AxiosInstance,
    autoLoginHandler: () => Promise<boolean>,
    getAuthInfoHandler: () => Promise<{ cookies: string; csrfToken: string }>
) {
    authInterceptor = new AuthInterceptor(instance)
    authInterceptor.setAutoLoginHandler(autoLoginHandler)
    authInterceptor.setGetAuthInfoHandler(getAuthInfoHandler)
    
    console.log('[Auth] axios 拦截器已初始化')
}

/**
 * 获取全局的认证拦截器实例
 */
export function getAuthInterceptor(): AuthInterceptor | null {
    return authInterceptor
}

export default AuthInterceptor
