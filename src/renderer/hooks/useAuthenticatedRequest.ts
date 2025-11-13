/**
 * useAuthenticatedRequest - 用于发送认证请求的 composable
 * 
 * 自动处理：
 * 1. 认证信息的添加
 * 2. 401 错误的自动重试
 * 3. 网络错误的重试
 * 4. 错误提示
 */

import { ref } from 'vue'
import httpClient from '../services/http-client'
import { AxiosRequestConfig } from 'axios'

interface RequestConfig extends AxiosRequestConfig {
    retryCount?: number
    retryDelay?: number
}

export function useAuthenticatedRequest() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    /**
     * 发送请求（带自动重试）
     */
    const request = async <T = any>(config: RequestConfig): Promise<T | null> => {
        loading.value = true
        error.value = null

        try {
            const data = await httpClient.request<T>(config)
            return data
        } catch (err) {
            const message = err instanceof Error ? err.message : '请求失败'
            error.value = message
            console.error('[Request] 请求失败:', message)
            return null
        } finally {
            loading.value = false
        }
    }

    /**
     * 发送 GET 请求
     */
    const get = async <T = any>(
        url: string,
        config?: RequestConfig
    ): Promise<T | null> => {
        return request<T>({
            ...config,
            method: 'GET',
            url
        })
    }

    /**
     * 发送 POST 请求
     */
    const post = async <T = any>(
        url: string,
        data?: any,
        config?: RequestConfig
    ): Promise<T | null> => {
        return request<T>({
            ...config,
            method: 'POST',
            url,
            data
        })
    }

    /**
     * 发送 PUT 请求
     */
    const put = async <T = any>(
        url: string,
        data?: any,
        config?: RequestConfig
    ): Promise<T | null> => {
        return request<T>({
            ...config,
            method: 'PUT',
            url,
            data
        })
    }

    /**
     * 发送 DELETE 请求
     */
    const del = async <T = any>(
        url: string,
        config?: RequestConfig
    ): Promise<T | null> => {
        return request<T>({
            ...config,
            method: 'DELETE',
            url
        })
    }

    /**
     * 清除错误信息
     */
    const clearError = () => {
        error.value = null
    }

    return {
        loading,
        error,
        request,
        get,
        post,
        put,
        del,
        clearError
    }
}
