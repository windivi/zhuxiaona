/**
 * HTTP 请求工具函数 - 集成错误处理和重试机制
 * 
 * 特性：
 * 1. 自动处理网络错误和服务器错误
 * 2. 请求失败自动重试（可配置）
 * 3. 统一的错误处理
 * 
 * 注意：认证和 Cookie 由 Electron 主进程的 webRequest 拦截器自动处理
 */

import axios, { AxiosRequestConfig, AxiosError } from 'axios'

interface RequestOptions extends AxiosRequestConfig {
	retryCount?: number  // 重试次数，默认 3
	retryDelay?: number  // 重试延迟（毫秒），默认 1000
}

class HttpClient {
	private retryCount: number = 3
	private retryDelay: number = 1000

	/**
	 * 发送 GET 请求
	 */
	async get<T = any>(url: string, config?: RequestOptions): Promise<T> {
		return this.request<T>({
			...config,
			method: 'GET',
			url
		})
	}

	/**
	 * 发送 POST 请求
	 */
	async post<T = any>(url: string, data?: any, config?: RequestOptions): Promise<T> {
		return this.request<T>({
			...config,
			method: 'POST',
			url,
			data
		})
	}

	/**
	 * 发送 PUT 请求
	 */
	async put<T = any>(url: string, data?: any, config?: RequestOptions): Promise<T> {
		return this.request<T>({
			...config,
			method: 'PUT',
			url,
			data
		})
	}

	/**
	 * 发送 DELETE 请求
	 */
	async delete<T = any>(url: string, config?: RequestOptions): Promise<T> {
		return this.request<T>({
			...config,
			method: 'DELETE',
			url
		})
	}

	/**
	 * 发送请求（带自动重试）
	 */
	async request<T = any>(config: RequestOptions): Promise<T> {
		const maxRetries = config.retryCount ?? this.retryCount
		const retryDelay = config.retryDelay ?? this.retryDelay

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await axios.request<T>(config)
				return response.data
			} catch (error) {
				const axiosError = error as AxiosError

				// 其他可重试的错误
				if (attempt < maxRetries) {
					const isNetworkError = !axiosError.response
					const isServerError = axiosError.response?.status ? axiosError.response.status >= 500 : false
					const isClientError = axiosError.code === 'ECONNABORTED'

					if (isNetworkError || isServerError || isClientError) {
						console.log(`[HttpClient] 请求失败，${retryDelay}ms 后进行第 ${attempt + 1} 次重试...`)
						await this.sleep(retryDelay)
						continue
					}
				}

				// 最后一次尝试仍然失败，抛出错误
				throw error
			}
		}

		throw new Error(`请求失败：超过最大重试次数 ${maxRetries}`)
	}

	/**
	 * 延迟函数
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}

// 创建全局实例
const httpClient = new HttpClient()

export default httpClient
export { HttpClient }
