import { app, session, BrowserWindow } from 'electron';
import { browserAutomation } from './services/browserAutomation';
import { logCollector } from './log/log-collector';
import { detectHardwareAccel } from './services/hw-accel';
import { startTranscodeServer } from './services/transcode-server';
import { createWindow } from './ui/window';
import { registerIpcHandlers } from './ipc/ipc-handlers';
import { getCookies, getCsrfToken, setCookies } from './auth/auth-state';

let _transcodeServerPort = 0;
let _hwAccelType: string | null = null; // 硬件加速类型

async function doCreateWindow() {
  const mainWindow = createWindow(logCollector);
  return mainWindow;
}

app.whenReady().then(async () => {
  await doCreateWindow();

  // 检测硬件加速
  _hwAccelType = await detectHardwareAccel();

  // 启动本地转码服务
  try {
    const port = await startTranscodeServer(_hwAccelType);
    _transcodeServerPort = port;
    console.log('transcode server started on port', port);
  } catch (err) {
    console.error('failed to start transcode server', err);
  }

  // 注册 IPC handlers（通过闭包传入需要的依赖）
  registerIpcHandlers({
    browserAutomation,
    getTranscodePort: () => _transcodeServerPort
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const cookieValue = getCookies();
    const csrfToken = getCsrfToken();

    if (cookieValue) {
      details.requestHeaders['cookie'] = cookieValue;
      console.log('[WebRequest] 添加 Cookie 到请求:', details.url.substring(0, 60));
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
          console.log('[WebRequest] 从响应头获取 Cookie:', cookies.substring(0, 60));
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