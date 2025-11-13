import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import { setCookies, setCsrfToken, getAuthInfo, getCookies, getCsrfToken } from '../auth/auth-state';

type HandlersOptions = {
  browserAutomation: any,
  getTranscodePort: () => number,
};

export function registerIpcHandlers(options: HandlersOptions) {
  const { browserAutomation, getTranscodePort } = options;

  ipcMain.handle('get-transcode-url', (event, inputUrl: string) => {
    const port = getTranscodePort();
    if (!port) return { success: false, message: 'transcode server not ready' };
    const encoded = encodeURIComponent(inputUrl || '');
    return { success: true, url: `http://127.0.0.1:${port}/transcode.mp4?url=${encoded}` };
  });

  ipcMain.handle('should-transcode', async (event, inputUrl: string) => {
    return new Promise((resolve) => {
      const ffprobe = spawn('ffprobe', [
        '-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','json',inputUrl
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
      console.log('开始自动登录流程...');
      const result = await browserAutomation.autoLogin(credentials);
      if (result.success) {
        setCookies(result.cookies);
        setCsrfToken(result.csrfToken);
        console.log('自动登录成功，已设置全局 cookie 和 csrf-token');
        return { success: true, message: '登录成功', cookies: result.cookies, csrfToken: result.csrfToken };
      } else { console.error('自动登录失败:', result.error); return { success: false, message: result.error || '登录失败' }; }
    } catch (error) { console.error('自动登录过程中发生错误:', error); return { success: false, message: error instanceof Error ? error.message : '未知错误' }; }
  });

  ipcMain.handle('get-auth-info', () => getAuthInfo());

  ipcMain.handle('set-auth-info', (event, { cookies, csrfToken: token }) => { if (cookies) setCookies(cookies); if (token) setCsrfToken(token); console.log('[IPC] 手动设置认证信息成功'); return { success: true }; });

  ipcMain.handle('close-browser-automation', async () => { try { await browserAutomation.closeBrowser(); return { success: true, message: '浏览器已关闭' }; } catch (error) { console.error('关闭浏览器失败:', error); return { success: false, message: '关闭浏览器失败' }; } });

  ipcMain.on('message', (event, message) => { console.log(message); event.reply('reply', '主进程已收到消息: ' + message); });
  ipcMain.on('set-cookie', (event, value) => { });
}
