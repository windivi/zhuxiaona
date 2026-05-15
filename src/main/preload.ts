import { contextBridge, ipcRenderer } from 'electron';

type DesktopSourcePayload = {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string;
	appIcon: string | null;
};

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string) => ipcRenderer.send('message', message),
  getAuthInfo: () => ipcRenderer.invoke('get-auth-info'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  getDesktopCapturerSource : () => ipcRenderer.invoke('screenshot', []) as Promise<DesktopSourcePayload[]>,
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  onLogMessage: (callback: (log: any) => void) => {
    ipcRenderer.on('log-message', (event, log) => callback(log))
  }
})

