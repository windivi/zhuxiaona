import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

interface AuthData {
  cookies?: string
  csrfToken?: string
  timestamp?: number
}

class AuthStorage {
  private storagePath: string
  private data: AuthData = {}

  constructor() {
    const userDataPath = app.getPath('userData')
    this.storagePath = join(userDataPath, 'auth.json')
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const content = fs.readFileSync(this.storagePath, 'utf-8')
        const parsed = JSON.parse(content)
        this.data = parsed || {}
        console.log('[AuthStorage] 认证信息已从磁盘加载')
      }
    } catch (error) {
      console.error('[AuthStorage] 加载认证信息失败:', error)
      this.data = {}
    }
  }

  private save() {
    try {
      const content = JSON.stringify(this.data, null, 2)
      fs.writeFileSync(this.storagePath, content, 'utf-8')
      console.log('[AuthStorage] 认证信息已保存到磁盘')
    } catch (error) {
      console.error('[AuthStorage] 保存认证信息失败:', error)
    }
  }

  getAuth(): AuthData {
    return { ...this.data }
  }

  setCookies(cookies: string) {
    if (cookies && cookies !== this.data.cookies) {
      this.data.cookies = cookies
      this.data.timestamp = Date.now()
      this.save()
      console.log('[AuthStorage] Cookies 已更新')
    }
  }

  getCookies(): string | undefined {
    return this.data.cookies
  }

  setCsrfToken(token: string) {
    if (token && token !== this.data.csrfToken) {
      this.data.csrfToken = token
      this.data.timestamp = Date.now()
      this.save()
      console.log('[AuthStorage] CSRF Token 已更新')
    }
  }

  getCsrfToken(): string | undefined {
    return this.data.csrfToken
  }

  updateAuth(auth: AuthData) {
    if (auth.cookies) this.data.cookies = auth.cookies
    if (auth.csrfToken) this.data.csrfToken = auth.csrfToken
    this.data.timestamp = Date.now()
    this.save()
    console.log('[AuthStorage] 认证信息已更新')
  }

  clear() {
    this.data = {}
    try {
      if (fs.existsSync(this.storagePath)) {
        fs.unlinkSync(this.storagePath)
      }
    } catch (error) {
      console.error('[AuthStorage] 清空认证信息失败:', error)
    }
    console.log('[AuthStorage] 认证信息已清空')
  }
}

export const authStorage = new AuthStorage()
