import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import { browserAutomation } from './browserAutomation';

// 转码服务相关
import * as http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';

let _transcodeServerPort = 0;
let _hwAccelType: string | null = null; // 硬件加速类型

// 检测可用的硬件加速(仅在Windows上检测)
async function detectHardwareAccel(): Promise<string | null> {
	if (process.platform !== 'win32') return null;

	return new Promise((resolve) => {
		// 测试DXVA2(Intel/AMD/NVIDIA都支持)
		const test = spawn('ffmpeg', [
			'-hide_banner',
			'-loglevel', 'error',
			'-hwaccels'
		], { windowsHide: true });

		let output = '';
		test.stdout.on('data', (chunk: Buffer) => {
			output += chunk.toString();
		});

		test.on('close', () => {
			// DXVA2 是 Windows 上最通用的硬件加速
			if (output.includes('dxva2')) {
				console.log('[HW Accel] DXVA2 available');
				resolve('dxva2');
			} else if (output.includes('d3d11va')) {
				console.log('[HW Accel] D3D11VA available');
				resolve('d3d11va');
			} else {
				console.log('[HW Accel] No hardware acceleration detected');
				resolve(null);
			}
		});

		test.on('error', () => resolve(null));

		// 超时保护
		setTimeout(() => {
			try { test.kill(); } catch (e) { }
			resolve(null);
		}, 3000);
	});
}

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

				// 启动 ffmpeg 实时转码到 fragmented MP4,输出到 stdout
				// 需要系统安装 ffmpeg 并可在 PATH 中找到
				// 针对 i5-9400F + GT710 优化的转码参数
				const args = [
					'-hide_banner',
					'-loglevel', 'error',
				];

				// 如果检测到硬件加速,尝试使用(GT710支持H.264硬解)
				if (_hwAccelType) {
					args.push('-hwaccel', _hwAccelType);
					args.push('-hwaccel_output_format', _hwAccelType);
				}

				args.push(
					// 输入优化
					'-fflags', '+nobuffer+fastseek',
					'-analyzeduration', '1000000',  // 1秒分析时间,提高格式兼容性
					'-probesize', '5000000',        // 5MB探测大小
					'-i', input,
					// 视频编码: H.264 baseline,适配低端设备
					'-c:v', 'libx264',
					'-preset', 'ultrafast',         // 最快编码速度
					'-tune', 'zerolatency',
					'-profile:v', 'baseline',       // baseline profile 兼容性最好
					'-level', '3.0',                // level 3.0 适配大部分设备
					'-b:v', '1200k',                // 降低码率减轻CPU压力
					'-maxrate', '1500k',
					'-bufsize', '3000k',
					'-g', '30',                     // GOP 30帧,降低解码复杂度
					'-keyint_min', '30',
					// 分辨率限制到720p
					'-vf', 'scale=trunc(min(iw\\,1280)/2)*2:trunc(min(ih\\,720)/2)*2',
					'-r', '25',                     // 限制帧率到25fps
					// 音频编码
					'-c:a', 'aac',
					'-b:a', '96k',
					'-ar', '44100',
					'-ac', '2',
					// 输出格式
					'-f', 'mp4',
					'-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
					'pipe:1'
				);

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

				let errorLog = '';
				ffmpeg.stderr.on('data', (chunk: Buffer) => {
					errorLog += chunk.toString();
					// 可选:解析进度信息
					const progressMatch = chunk.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
					if (progressMatch) {
						// console.log('[transcode] progress:', progressMatch[1]);
					}
				});

				ffmpeg.on('error', (err: any) => {
					console.error('[transcode] ffmpeg error:', err);
					try { res.end(); } catch (e) { }
				});

				// 当客户端断开时，确保关闭 ffmpeg
				req.on('close', () => {
					try {
						if (ffmpeg && !ffmpeg.killed) ffmpeg.kill('SIGKILL');
					} catch (e) { }
				});

				ffmpeg.on('close', (code: number, signal: string) => {
					if (code !== 0 && code !== null) {
						console.error(`[transcode] ffmpeg exited with code ${code}`);
						console.error('[transcode] stderr:', errorLog);
					}
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

	// 检测硬件加速
	_hwAccelType = await detectHardwareAccel();

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
			console.log('[WebRequest] 添加 Cookie 到请求:', details.url.substring(0, 60))
		}
		if (csrfToken) {
			details.requestHeaders['x-csrf-token'] = csrfToken
		}
		callback({ requestHeaders: details.requestHeaders })
	})
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		// 提取 Set-Cookie 并保存到全局变量
		if (details.responseHeaders) {
			const setCookieHeaders = details.responseHeaders['set-cookie']
			if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
				// 合并所有 cookie
				const cookies = setCookieHeaders
					.map(cookie => cookie.split(';')[0]) // 只取 name=value 部分，去掉 path、domain 等
					.join('; ')
				if (cookies) {
					cookieValue = cookies
					console.log('[WebRequest] 从响应头获取 Cookie:', cookieValue.substring(0, 60))
				}
			}
		}

		callback({
			responseHeaders: {
				...details.responseHeaders,
				// CSP 策略允许必要的资源加载
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
	// 返回两个可选路径:带 .mp4 的路径可以满足部分播放器对字符串检查的要求
	return {
		success: true,
		url: `http://127.0.0.1:${_transcodeServerPort}/transcode.mp4?url=${encoded}`
	};
});

// IPC: 智能检测视频是否需要转码
ipcMain.handle('should-transcode', async (event, inputUrl: string) => {
	return new Promise((resolve) => {
		const ffprobe = spawn('ffprobe', [
			'-v', 'error',
			'-select_streams', 'v:0',
			'-show_entries', 'stream=codec_name,width,height',
			'-of', 'json',
			inputUrl
		], { windowsHide: true });

		let output = '';
		ffprobe.stdout.on('data', (chunk: Buffer) => {
			output += chunk.toString();
		});

		ffprobe.on('close', (code) => {
			if (code !== 0) {
				// ffprobe 失败,建议转码
				resolve({ success: true, shouldTranscode: true, reason: 'probe_failed' });
				return;
			}

			try {
				const data = JSON.parse(output);
				const stream = data.streams?.[0];
				if (!stream) {
					resolve({ success: true, shouldTranscode: true, reason: 'no_stream' });
					return;
				}

				const codec = String(stream.codec_name || '').toLowerCase();
				const width = parseInt(stream.width) || 0;
				const height = parseInt(stream.height) || 0;

				// 需要转码的情况:
				// 1. HEVC/H.265 编码(GT710不支持)
				// 2. VP8/VP9/AV1 等 WebM 编码
				// 3. ProRes/DNxHD 等专业编解码器
				// 4. 分辨率超过 1920x1080
				const needTranscode = 
					codec.includes('hevc') || codec.includes('h265') ||
					codec.includes('vp8') || codec.includes('vp9') || codec.includes('av1') ||
					codec.includes('prores') || codec.includes('dnxhd') ||
					width > 1920 || height > 1080;

				resolve({
					success: true,
					shouldTranscode: needTranscode,
					reason: needTranscode ? `codec=${codec}, res=${width}x${height}` : 'compatible',
					codec,
					width,
					height
				});
			} catch (e) {
				resolve({ success: true, shouldTranscode: true, reason: 'parse_error' });
			}
		});

		ffprobe.on('error', () => {
			resolve({ success: true, shouldTranscode: true, reason: 'ffprobe_not_found' });
		});

		// 超时保护(3秒)
		setTimeout(() => {
			try { ffprobe.kill(); } catch (e) { }
			resolve({ success: true, shouldTranscode: true, reason: 'timeout' });
		}, 3000);
	});
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