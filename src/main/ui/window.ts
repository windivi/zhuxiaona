import { BrowserWindow, app } from 'electron';
import { join } from 'path';

export function createWindow(logCollector: any) {
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
  // preload.js 位于 build/main 目录（src/main/preload.ts -> build/main/preload.js），
  // __dirname 在编译后为 build/main/ui，因此向上一级查找 preload.js
  preload: join(__dirname, '..', 'preload.js'),
    },
  });

  logCollector.setMainWindow(mainWindow);
  mainWindow.setTitle('朱小娜专用版');
  mainWindow.setMenuBarVisibility(false);

  if (process.env.NODE_ENV === 'development') {
    const rendererPort = process.argv[2];
    mainWindow.loadURL(`http://localhost:${rendererPort}`);
    mainWindow.webContents.openDevTools();
  }
  else {
    mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'));
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        mainWindow.webContents.openDevTools();
      }
    });
  }

  return mainWindow;
}
