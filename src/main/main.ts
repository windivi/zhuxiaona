import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import { browserAutomation } from './browserAutomation';

// 转码服务相关
import * as http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';

let _transcodeServerPort = 0;

function startTranscodeServer() {
	return new Promise<number>((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			try {
				if (!req.url) {
					res.writeHead(400);
					res.end('Bad Request');
					return;
				}

				const full = new URL(req.url, `http://127.0.0.1`);
				// 支持两种路径：/transcode 或 /transcode.mp4（后者可满足部分播放器要求 URL 包含 .mp4）
				if (!full.pathname.startsWith('/transcode')) {
					res.writeHead(404);
					res.end('Not Found');
					return;
				}

				const input = full.searchParams.get('url') || '';
				if (!input) {
					res.writeHead(400);
					res.end('missing url param');
					return;
				}

				// 只允许 http(s) 输入，避免文件系统等危险输入
				if (!/^https?:\/\//i.test(input)) {
					res.writeHead(400);
					res.end('only http(s) urls are allowed');
					return;
				}

				// 启动 ffmpeg 实时转码到 fragmented MP4，输出到 stdout
				// 需要系统安装 ffmpeg 并可在 PATH 中找到
				const args = [
					'-hide_banner',
					'-loglevel', 'error',
					'-fflags', 'nobuffer',
					'-analyzeduration', '0',
					'-probesize', '32',
					'-i', input,
					'-c:v', 'libx264',
					'-preset', 'veryfast',
					'-tune', 'zerolatency', '-b:v', '1500k',
					'-vf', 'scale=trunc(min(iw,(720*iw/ih))/2)*2:trunc(min(ih,720)/2)*2',
					'-c:a', 'aac',
					'-b:a', '96k',
					'-f', 'mp4',
					'-movflags', 'frag_keyframe+empty_moov+default_base_moof',
					'pipe:1'
				];

				let ffmpeg: any = null;
				try {
					ffmpeg = spawn('ffmpeg', args, { windowsHide: true });
				} catch (e) {
					res.writeHead(500);
					res.end('failed to start ffmpeg: ' + String(e));
					return;
				}

				res.writeHead(200, {
					'Content-Type': 'video/mp4',
					'Cache-Control': 'no-cache',
					'Connection': 'close'
				});

				// pipe ffmpeg stdout to response
				ffmpeg.stdout.pipe(res);

				ffmpeg.stderr.on('data', (chunk: Buffer) => {
					// 仅在开发或调试时可打印日志
					// console.error('ffmpeg stderr:', chunk.toString());
				});

				ffmpeg.on('error', (err: any) => {
					try { res.end(); } catch (e) { }
				});

				// 当客户端断开时，确保关闭 ffmpeg
				req.on('close', () => {
					try {
						if (ffmpeg && !ffmpeg.killed) ffmpeg.kill('SIGKILL');
					} catch (e) { }
				});

				ffmpeg.on('close', (code: number, signal: string) => {
					try { res.end(); } catch (e) { }
				});

			} catch (err) {
				res.writeHead(500);
				res.end('server error');
			}
		});

		server.on('error', (err) => reject(err));
		server.listen(0, '127.0.0.1', () => {
			// @ts-ignore
			const addr = server.address();
			if (addr && typeof addr === 'object') {
				_transcodeServerPort = addr.port;
				resolve(_transcodeServerPort);
			} else {
				reject(new Error('failed to get server port'));
			}
		});
	});
}

let cookieValue = '';
let csrfToken = '';
async function createWindow() {
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		title: '朱小娜专用版',
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false,
			allowRunningInsecureContent: true,
			preload: join(__dirname, 'preload.js'),
		},
	});
	mainWindow.setTitle('朱小娜专用版');
	mainWindow.setMenuBarVisibility(false);

	if (process.env.NODE_ENV === 'development') {
		const rendererPort = process.argv[2];
		mainWindow.loadURL(`http://localhost:${rendererPort}`);
		mainWindow.webContents.openDevTools();
	}
	else {
		mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'));
		// 生产模式下监听F12打开控制台
		mainWindow.webContents.on('before-input-event', (event, input) => {
			if (input.key === 'F12' && input.type === 'keyDown') {
				mainWindow.webContents.openDevTools();
			}
		});
	}
}

app.whenReady().then(async () => {
	createWindow();

	// 启动本地转码服务
	try {
		const port = await startTranscodeServer();
		console.log('transcode server started on port', port);
	} catch (err) {
		console.error('failed to start transcode server', err);
	}

	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		if (cookieValue) {
			details.requestHeaders['cookie'] = cookieValue
		}
		if (csrfToken) {
			details.requestHeaders['x-csrf-token'] = csrfToken
		}
		callback({ requestHeaders: details.requestHeaders })
	})
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				// 允许 wasm/webassembly 的某些运行时需要的 eval 行为：增加 'unsafe-eval'
				// 注意：在生产环境放开 'unsafe-eval' 会降低 CSP 的安全性，请评估风险或仅在受信任环境中使用。
				'Content-Security-Policy': ["script-src 'self' 'unsafe-eval'"]
			}
		})
	})

	app.on('activate', function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// IPC: 给渲染进程返回本地转码地址
ipcMain.handle('get-transcode-url', (event, inputUrl: string) => {
	if (!_transcodeServerPort) {
		return { success: false, message: 'transcode server not ready' };
	}
	const encoded = encodeURIComponent(inputUrl || '');
	// 返回两个可选路径：带 .mp4 的路径可以满足部分播放器对字符串检查的要求
	return {
		success: true,
		url: `http://127.0.0.1:${_transcodeServerPort}/transcode.mp4?url=${encoded}`
	};
});

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
});

ipcMain.on('message', (event, message) => {
	console.log(message);

	event.reply('reply', '主进程已收到消息: ' + message);
});

ipcMain.on('set-cookie', (event, value) => {
	// cookieValue = value || ''
	// console.log('主进程收到cookie:', cookieValue)
})

// 新增：自动登录功能
ipcMain.handle('auto-login', async (event, credentials) => {
	try {
		console.log('开始自动登录流程...');
		const result = await browserAutomation.autoLogin(credentials);

		if (result.success) {
			// 设置全局的 cookie 和 csrf-token
			cookieValue = result.cookies;
			csrfToken = result.csrfToken;

			console.log('自动登录成功，已设置全局 cookie 和 csrf-token');
			console.log('Cookie:', cookieValue);
			console.log('CSRF Token:', csrfToken);

			return {
				success: true,
				message: '登录成功',
				cookies: result.cookies,
				csrfToken: result.csrfToken
			};
		} else {
			console.error('自动登录失败:', result.error);
			return {
				success: false,
				message: result.error || '登录失败'
			};
		}
	} catch (error) {
		console.error('自动登录过程中发生错误:', error);
		return {
			success: false,
			message: error instanceof Error ? error.message : '未知错误'
		};
	}
});

// 获取当前的 cookie 和 csrf-token
ipcMain.handle('get-auth-info', () => {
	return {
		cookies: cookieValue,
		csrfToken: csrfToken
	};
});

// 手动设置 cookie 和 csrf-token
ipcMain.handle('set-auth-info', (event, { cookies, csrfToken: token }) => {
	if (cookies) cookieValue = cookies;
	if (token) csrfToken = token;

	console.log('手动设置认证信息成功');
	return { success: true };
});

// 关闭浏览器自动化
ipcMain.handle('close-browser-automation', async () => {
	try {
		await browserAutomation.closeBrowser();
		return { success: true, message: '浏览器已关闭' };
	} catch (error) {
		console.error('关闭浏览器失败:', error);
		return { success: false, message: '关闭浏览器失败' };
	}
});