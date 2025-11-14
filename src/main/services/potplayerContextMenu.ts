import { Menu, BrowserWindow } from 'electron';
import { execSync } from 'child_process';

/**
 * 为 Electron 窗口添加 PotPlayer 右键菜单功能
 */
export function setupPotPlayerContextMenu(mainWindow: BrowserWindow) {
	mainWindow.webContents.on('context-menu', (event: any, params: any) => {
		const { linkUrl, selectionText, srcUrl, mediaType } = params;
		
		// 获取视频 URL：优先级为 srcUrl > linkUrl > selectionText
		let videoUrl: string | null = null;
		let isVideo = false;

		// 如果右键点击的是视频/音频元素
		if (srcUrl && (mediaType === 'video' || mediaType === 'audio')) {
			videoUrl = srcUrl;
			isVideo = true;
		}
		// 如果是链接
		else if (linkUrl) {
			videoUrl = linkUrl;
		}
		// 如果有选中的文本且是有效的 URL
		else if (selectionText && isValidUrl(selectionText)) {
			videoUrl = selectionText;
		}

		// 如果没有找到合适的 URL，不显示菜单
		if (!videoUrl) {
			return;
		}

		const menu = new Menu();

		// 添加 PotPlayer 打开选项
		menu.append(
			new (Menu as any).MenuItem({
				label: isVideo ? 'Open Video with PotPlayer' : 'Open with PotPlayer',
				click: () => {
					openWithPotPlayer(videoUrl!);
				}
			})
		);

		// 添加分隔符
		menu.append(
			new (Menu as any).MenuItem({
				type: 'separator'
			})
		);

		// 添加复制链接选项
		menu.append(
			new (Menu as any).MenuItem({
				label: 'Copy URL',
				click: () => {
					mainWindow.webContents.copy();
				}
			})
		);

		// 标准菜单项
		menu.append(
			new (Menu as any).MenuItem({
				type: 'separator'
			})
		);

		menu.append(
			new (Menu as any).MenuItem({
				label: 'Copy',
				visible: !!selectionText,
				click: () => {
					mainWindow.webContents.copy();
				}
			})
		);

		menu.append(
			new (Menu as any).MenuItem({
				label: 'Paste',
				click: () => {
					mainWindow.webContents.paste();
				}
			})
		);

		menu.popup({ window: mainWindow });
	});
}

/**
 * 使用 PotPlayer 打开 URL
 */
function openWithPotPlayer(url: string) {
	try {
		// PotPlayer 使用自定义协议 potplayer://
		// 格式: potplayer://https://example.com/video.mp4
		const potplayerUrl = `potplayer://${url}`;

		// Windows 系统
		if (process.platform === 'win32') {
			// 使用 start 命令打开 potplayer 协议
			execSync(`start "${potplayerUrl}"`);
		}
		// macOS
		else if (process.platform === 'darwin') {
			execSync(`open "${potplayerUrl}"`);
		}
		// Linux
		else if (process.platform === 'linux') {
			execSync(`xdg-open "${potplayerUrl}"`);
		}

		console.log('Opened with PotPlayer:', url);
	} catch (error) {
		console.error('Failed to open with PotPlayer:', error);
		// 可选：显示错误通知给用户
		// showErrorNotification('Failed to open with PotPlayer. Make sure PotPlayer is installed.');
	}
}

/**
 * 判断字符串是否是有效的 URL
 */
function isValidUrl(str: string): boolean {
	try {
		new URL(str);
		return true;
	} catch (_) {
		return false;
	}
}
