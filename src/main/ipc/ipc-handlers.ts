import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { setCookies, setCsrfToken, getAuthInfo, getCookies, getCsrfToken } from '../auth/auth-state';

type HandlersOptions = {
	browserAutomation: any,
	getTranscodePort: () => number,
};

export function registerIpcHandlers(options: HandlersOptions) {
	const { browserAutomation, getTranscodePort } = options;

	ipcMain.handle('get-transcode-port', () => {
		const port = getTranscodePort();
		console.log('[ipc] get-transcode-port:', port);
		return port || 0;
	});

	ipcMain.handle('get-transcode-url', async (event, inputUrl: string) => {
		const port = getTranscodePort();
		console.log('[ipc] 🎬 开始处理转码请求');
		console.log('[ipc] 转码服务端口:', port, '视频URL:', inputUrl);
		if (!port) {
			console.error('[ipc] ❌ 转码服务端口不可用!');
			return { success: false, message: 'transcode server not ready' };
		}
		
		const encoded = encodeURIComponent(inputUrl || '');
		const transcodeUrl = `http://127.0.0.1:${port}/transcode?url=${encoded}`;
		console.log('[ipc] 📡 调用转码服务:', transcodeUrl);
		
		try {
			const requestStartTime = Date.now();
			// 调用本地转码服务的 /transcode 端点
			console.log('[ipc] 📤 发送转码请求...');
			const response = await fetch(transcodeUrl);
			const elapsedTime = Date.now() - requestStartTime;
			console.log('[ipc] 📥 收到转码服务响应，耗时:', elapsedTime, 'ms, 状态码:', response.status);
			
			if (!response.ok) {
				console.error('[ipc] ❌ 转码服务返回错误状态:', response.status);
				return { success: false, message: `transcode service returned ${response.status}` };
			}
			
			const result = await response.json();
			console.log('[ipc] ✅ 转码完成! 返回缓存ID:', result.cacheId);
			
			if (result.success && result.cacheId) {
				// 返回缓存ID给前端
				return { success: true, cacheId: result.cacheId };
			} else {
				console.error('[ipc] ❌ 转码结果无效:', result);
				return { success: false, message: result.message || 'transcode failed' };
			}
		} catch (err) {
			console.error('[ipc] ❌ 调用转码服务时出错:', err);
			return { success: false, message: err instanceof Error ? err.message : 'unknown error' };
		}
	});

	ipcMain.handle('should-transcode', async (event, inputUrl: string) => {
		return new Promise((resolve) => {
			const ffprobe = spawn('ffprobe', [
				'-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', inputUrl
			], { windowsHide: true });

			let output = '';
			ffprobe.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });

			ffprobe.on('close', (code) => {
				if (code !== 0) { resolve({ success: true, shouldTranscode: true, reason: 'probe_failed' }); return; }
				try {
					const data = JSON.parse(output);
					const stream = data.streams?.[0];
					if (!stream) { resolve({ success: true, shouldTranscode: true, reason: 'no_stream' }); return; }
					const codec = String(stream.codec_name || '').toLowerCase();
					const width = parseInt(stream.width) || 0;
					const height = parseInt(stream.height) || 0;
					const needTranscode = codec.includes('hevc') || codec.includes('h265') || codec.includes('vp8') || codec.includes('vp9') || codec.includes('av1') || codec.includes('prores') || codec.includes('dnxhd') || width > 1920 || height > 1080;
					resolve({ success: true, shouldTranscode: needTranscode, reason: needTranscode ? `codec=${codec}, res=${width}x${height}` : 'compatible', codec, width, height });
				} catch (e) { resolve({ success: true, shouldTranscode: true, reason: 'parse_error' }); }
			});

			ffprobe.on('error', () => { resolve({ success: true, shouldTranscode: true, reason: 'ffprobe_not_found' }); });
			setTimeout(() => { try { ffprobe.kill(); } catch (e) { } resolve({ success: true, shouldTranscode: true, reason: 'timeout' }); }, 3000);
		});
	});

	ipcMain.handle('auto-login', async (event, credentials) => {
		try {
			const result = await browserAutomation.autoLogin(credentials);
			if (result.success) {
				setCookies(result.cookies);
				setCsrfToken(result.csrfToken);
				return { success: true, message: '登录成功', cookies: result.cookies, csrfToken: result.csrfToken };
			} else { console.error('自动登录失败:', result.error); return { success: false, message: result.error || '登录失败' }; }
		} catch (error) { console.error('自动登录过程中发生错误:', error); return { success: false, message: error instanceof Error ? error.message : '未知错误' }; }
	});

	ipcMain.handle('get-auth-info', () => getAuthInfo());

	ipcMain.handle('close-browser-automation', async () => { try { await browserAutomation.closeBrowser(); return { success: true, message: '浏览器已关闭' }; } catch (error) { console.error('关闭浏览器失败:', error); return { success: false, message: '关闭浏览器失败' }; } });

	ipcMain.on('message', (event, message) => { console.log(message); event.reply('reply', '主进程已收到消息: ' + message); });
	ipcMain.on('set-cookie', (event, value) => { });
}
