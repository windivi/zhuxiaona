import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message: string) => ipcRenderer.send('message', message),
  
  // 自动登录相关API
  autoLogin: (credentials: { username: string; password: string; dynamicCode: string }) => 
    ipcRenderer.invoke('auto-login', credentials),
  
  // 获取认证信息
  getAuthInfo: () => ipcRenderer.invoke('get-auth-info'),
  
  // 设置认证信息
  setAuthInfo: (authInfo: { cookies?: string; csrfToken?: string }) => 
    ipcRenderer.invoke('set-auth-info', authInfo),
  
  // 关闭浏览器自动化
  closeBrowserAutomation: () => ipcRenderer.invoke('close-browser-automation'),
  
  // 请求转码地址: 主进程会返回本地转码代理地址
  getTranscodeUrl: (inputUrl: string) => ipcRenderer.invoke('get-transcode-url', inputUrl),
  
  // 智能检测视频是否需要转码
  shouldTranscode: (inputUrl: string) => ipcRenderer.invoke('should-transcode', inputUrl),
})
