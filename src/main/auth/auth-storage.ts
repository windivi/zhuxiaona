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
		console.log('userDataPath', userDataPath)
		this.storagePath = join(userDataPath, 'auth.json')
		this.load()
	}

	private load() {
		try {
			if (fs.existsSync(this.storagePath)) {
				const content = fs.readFileSync(this.storagePath, 'utf-8')
				const parsed = JSON.parse(content)
				this.data = parsed || {}
			}
		} catch (error) {
			this.data = {}
		}
	}

	private save() {
		try {
			const content = JSON.stringify(this.data, null, 2)
			fs.writeFileSync(this.storagePath, content, 'utf-8')
		} catch (error) {
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
	}
}

export const authStorage = new AuthStorage()
