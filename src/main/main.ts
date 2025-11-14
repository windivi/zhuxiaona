import { app, session, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { browserAutomation } from './services/browserAutomation';
import { logCollector } from './log/log-collector';
import { createWindow } from './ui/window';
import { registerIpcHandlers } from './ipc/ipc-handlers';
import { getCookies, getCsrfToken, setCookies } from './auth/auth-state';

async function doCreateWindow() {
	const mainWindow = createWindow(logCollector);
	return mainWindow;
}

app.whenReady().then(async () => {
	await doCreateWindow();

	// 自动加载位于项目 `extensions/` 下的 unpacked extensions（如果存在）
	try {
		const repoRoot = path.resolve(__dirname, '..', '..');
		const extensionsDir = path.join(repoRoot, 'extensions');
		const extensionIds = [
			'cfdpeaefecdlkdlgdpjjllmhlnckcodp',
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
	registerIpcHandlers({
		browserAutomation,
	});

	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		const cookieValue = getCookies();
		const csrfToken = getCsrfToken();

		if (cookieValue) {
			details.requestHeaders['cookie'] = cookieValue;
		}
		if (csrfToken) {
			details.requestHeaders['x-csrf-token'] = csrfToken;
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