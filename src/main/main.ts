import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';
import { browserAutomation } from './browserAutomation';

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
        'Content-Security-Policy': ['script-src \'self\'']
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