import { ipcMain } from 'electron';
import { setCookies, setCsrfToken, getAuthInfo, getCookies, getCsrfToken } from '../auth/auth-state';

type HandlersOptions = {
	browserAutomation: any,
};

export function registerIpcHandlers(options: HandlersOptions) {
	const { browserAutomation } = options;
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
