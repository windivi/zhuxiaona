import { ipcMain } from 'electron';
import { getAuthInfo } from '../auth/auth-state';

type HandlersOptions = {
};

export function registerIpcHandlers(options: HandlersOptions) {
	ipcMain.handle('get-auth-info', () => getAuthInfo());
	ipcMain.on('message', (event, message) => { console.log(message); event.reply('reply', '主进程已收到消息: ' + message); });
	ipcMain.on('set-cookie', (event, value) => { });
}
