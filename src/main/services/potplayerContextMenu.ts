import { Menu, MenuItem, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * 为 Electron 窗口添加 PotPlayer 右键菜单功能
 */
export function setupPotPlayerContextMenu(mainWindow: BrowserWindow) {
	mainWindow.webContents.on('context-menu', (event: any, params: any) => {
		const { linkUrl, selectionText, srcURL, mediaType } = params;
		
		// 获取视频 URL：优先级为 srcURL > linkUrl > selectionText
		let videoUrl: string | null = null;
		let isVideo = false;

		// 如果右键点击的是视频/音频元素
		if (srcURL && (mediaType === 'video' || mediaType === 'audio')) {
			videoUrl = srcURL;
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
			new MenuItem({
				label: isVideo ? 'Open Video with PotPlayer' : 'Open with PotPlayer',
				click: () => {
					openWithPotPlayer(videoUrl!);
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

		// 异步执行，避免主进程卡住
		const execAsync = promisify(exec);
		
		// Windows 系统
		if (process.platform === 'win32') {
			// 使用 start 命令打开 potplayer 协议，添加 /b 标志以不等待返回
			execAsync(`start "" "${potplayerUrl}"`).catch(err => {
				console.error('Failed to open with PotPlayer:', err);
			});
		}
		// macOS
		else if (process.platform === 'darwin') {
			execAsync(`open "${potplayerUrl}"`).catch(err => {
				console.error('Failed to open with PotPlayer:', err);
			});
		}
		// Linux
		else if (process.platform === 'linux') {
			execAsync(`xdg-open "${potplayerUrl}"`).catch(err => {
				console.error('Failed to open with PotPlayer:', err);
			});
		}

		console.log('Opened with PotPlayer:', url);
	} catch (error) {
		console.error('Failed to open with PotPlayer:', error);
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
