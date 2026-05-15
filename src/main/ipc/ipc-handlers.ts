import { BrowserWindow, desktopCapturer, ipcMain, webContents } from 'electron';
import { getAuthInfo } from '../auth/auth-state';

type HandlersOptions = {
};

type DesktopSourcePayload = {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string;
	appIcon: string | null;
};

const toDataUrl = (image?: { toDataURL: () => string } | null) => image?.toDataURL() ?? null;

const toDesktopSourcePayload = (source: {
	id: string;
	name: string;
	display_id: string;
	thumbnail: { toDataURL: () => string };
	appIcon: { toDataURL: () => string } | null;
}): DesktopSourcePayload => ({
	id: source.id,
	name: source.name,
	display_id: source.display_id,
	thumbnail: source.thumbnail.toDataURL(),
	appIcon: toDataUrl(source.appIcon)
});

export function registerIpcHandlers(options: HandlersOptions) {
	ipcMain.handle('get-auth-info', () => getAuthInfo());
	ipcMain.handle('screenshot', async (_event, _args) => {
		return [
			...(await desktopCapturer.getSources({ types: ["window", "screen"] })).map(toDesktopSourcePayload),
			...(await selfWindws())
		];
	});
	ipcMain.on('message', (event, message) => { console.log(message); event.reply('reply', '主进程已收到消息: ' + message); });
	ipcMain.on('set-cookie', (event, value) => { });
}

const selfWindws = async (): Promise<DesktopSourcePayload[]> => {
	const visibleWindows = webContents
		.getAllWebContents()
		.flatMap(item => {
			const win = BrowserWindow.fromWebContents(item);
			return win && win.isVisible() ? [{ item, win }] : [];
		});

	return Promise.all(
		visibleWindows.map(async ({ item, win }) => {
			const thumbnail = await win.capturePage();
			// 当程序窗口打开DevTool的时候  也会计入
			return {
				name:
					win.getTitle() + (item.devToolsWebContents === null ? "" : "-dev"), // 给dev窗口加上后缀
				id: win.getMediaSourceId(),
				thumbnail: toDataUrl(thumbnail) ?? "",
				display_id: "",
				appIcon: null
			};
		})
	);
};