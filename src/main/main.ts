import { app, session, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { browserAutomation } from './services/browserAutomation';
import { logCollector } from './log/log-collector';
import { createWindow } from './ui/window';
import { registerIpcHandlers } from './ipc/ipc-handlers';
import { getCookies, getCsrfToken, setCookies, setCsrfToken, clearAuth } from './auth/auth-state';
import { setupPotPlayerContextMenu } from './services/potplayerContextMenu';

async function doCreateWindow() {
	const mainWindow = createWindow(logCollector);

	// 设置 PotPlayer 右键菜单
	setupPotPlayerContextMenu(mainWindow);

	return mainWindow;
}

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
	mainWindow = await doCreateWindow();

	// 自动加载位于项目 `extensions/` 下的 unpacked extensions（如果存在）
	try {
		const repoRoot = path.resolve(__dirname, '..', '..');
		const extensionsDir = path.join(repoRoot, 'extensions');
		const extensionIds = [
			'aleakchihdccplidncghkekgioiakgal',
		];

		for (const id of extensionIds) {
			const extPath = path.join(extensionsDir, id);
			if (fs.existsSync(extPath)) {
				try {
					const loaded = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
					console.log('Loaded extension', id, loaded && loaded.id ? loaded.id : 'unknown');
				} catch (e) {
					console.warn('Failed to load extension', id, e);
				}
			} else {
				console.info('Extension directory not found, skip:', extPath);
			}
		}
	} catch (e) {
		console.error('Error while loading extensions:', e);
	}

	// 注册 IPC handlers（通过闭包传入需要的依赖）
	registerIpcHandlers({});

	// 标志位：防止自动登录重复执行和重载锁定
	let isAutoLoginInProgress = false;
	let loginAttemptCount = 0;
	const MAX_LOGIN_ATTEMPTS = 3;
	let lastLoginAttemptTime = 0;
	const LOGIN_COOLDOWN = 5000; // 5秒冷却时间

	// 拦截 login 请求，执行自动登录
	session.defaultSession.webRequest.onBeforeRequest((details, callback) => {

		if (details.url.includes('login') && !isAutoLoginInProgress) {
			const now = Date.now();
			
			// 检查冷却时间和尝试次数
			if (now - lastLoginAttemptTime < LOGIN_COOLDOWN) {
				console.log('[Main] 登录冷却中，跳过本次自动登录');
				callback({});
				return;
			}

			if (loginAttemptCount >= MAX_LOGIN_ATTEMPTS) {
				console.error('[Main] 已达到最大登录尝试次数，停止自动登录');
				callback({});
				return;
			}

			isAutoLoginInProgress = true;
			loginAttemptCount++;
			lastLoginAttemptTime = now;
			console.log(`[Main] 检测到 login 请求，执行自动登录... (尝试 ${loginAttemptCount}/${MAX_LOGIN_ATTEMPTS})`);

			// 异步执行自动登录
			browserAutomation
				.autoLogin({ username: '13272009478', password: '13272009478@Hxn', dynamicCode: '666666' })
				.then((result: any) => {
					if (result.success) {
						console.log('[Main] 自动登录成功，保存 cookies');
						setCookies(result.cookies);
						setCsrfToken(result.csrfToken);
						loginAttemptCount = 0; // 重置计数器

						// 登录成功后重载窗口
						setTimeout(() => {
							if (mainWindow && !mainWindow.isDestroyed()) {
								console.log('[Main] 登录成功，重载窗口...');
								mainWindow.webContents.reload();
								isAutoLoginInProgress = false;
							}
						}, 500);
					} else {
						console.error('[Main] 自动登录失败:', result.error);

						// 登录失败：清空 cookies 和 token，然后重载
						clearAuth();
						setTimeout(() => {
							if (mainWindow && !mainWindow.isDestroyed()) {
								console.log('[Main] 登录失败，清空认证信息并重载窗口...');
								mainWindow.webContents.reload();
								isAutoLoginInProgress = false;
							}
						}, 500);
					}
				})
				.catch((error: any) => {
					console.error('[Main] 自动登录异常:', error);

					// 异常情况：清空 cookies 和 token，然后重载
					clearAuth();
					setTimeout(() => {
						if (mainWindow && !mainWindow.isDestroyed()) {
							console.log('[Main] 登录异常，清空认证信息并重载窗口...');
							mainWindow.webContents.reload();
							isAutoLoginInProgress = false;
						}
					}, 500);
				})
				.finally(() => {
					// 不在这里重置，在上面的 setTimeout 中重置
				});

			return;
		}

		callback({});
	});

	// 业务逻辑：在发送每个请求前，从 authStorage 查出 csrfToken 和 cookies 并注入请求头
	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		const cookieValue = getCookies();
		const csrfToken = getCsrfToken();
		
		// 从 authStorage 查出认证信息并注入请求头
		if (cookieValue) {
			details.requestHeaders['cookie'] = cookieValue;
			console.log(`[Main] 已注入 cookies，长度: ${cookieValue.length}`);
		}
		if (csrfToken) {
			details.requestHeaders['x-csrf-token'] = csrfToken;
			console.log(`[Main] 已注入 x-csrf-token`);
		}
		
		callback({ requestHeaders: details.requestHeaders });
	});

	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		if (details.responseHeaders) {
			const setCookieHeaders = details.responseHeaders['set-cookie'];
			if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
				const cookies = setCookieHeaders
					.map((cookie: string) => cookie.split(';')[0])
					.join('; ');
				if (cookies) {
					setCookies(cookies);
				}
			}
		}

		callback({
			responseHeaders: {
				...details.responseHeaders,
				'Content-Security-Policy': [
					"default-src 'self'; " +
					"script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; " +
					"style-src 'self' 'unsafe-inline' https:; " +
					"img-src 'self' data: https:; " +
					"font-src 'self' data: https:; " +
					"media-src 'self' blob: https: http:; " +
					"connect-src 'self' https: http: ws: wss:; " +
					"frame-src 'self' https:; " +
					"object-src 'none'; " +
					"base-uri 'self'; " +
					"form-action 'self'"
				]
			}
		});
	});

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) {
			doCreateWindow();
		}
	});
});

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit();
});