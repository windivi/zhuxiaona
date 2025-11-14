import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string) => ipcRenderer.send('message', message),
  getAuthInfo: () => ipcRenderer.invoke('get-auth-info'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  onLogMessage: (callback: (log: any) => void) => {
    ipcRenderer.on('log-message', (event, log) => callback(log))
  }
})

