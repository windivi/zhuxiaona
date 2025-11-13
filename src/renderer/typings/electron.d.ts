/**
 * Should match main/preload.ts for typescript support in renderer
 */
export default interface ElectronApi {
  sendMessage: (message: string) => void
  
  // 自动登录相关API
  autoLogin: (credentials: { username: string; password: string; dynamicCode: string }) => Promise<{
    success: boolean;
    message: string;
    cookies?: string;
    csrfToken?: string;
  }>
  
  // 获取认证信息
  getAuthInfo: () => Promise<{
    cookies: string;
    csrfToken: string;
  }>
  
  // 设置认证信息
  setAuthInfo: (authInfo: { cookies?: string; csrfToken?: string }) => Promise<{ success: boolean }>
  
  // 关闭浏览器自动化
  closeBrowserAutomation: () => Promise<{ success: boolean; message: string }>
  
  // 视频转码相关API
  getTranscodeUrl: (inputUrl: string) => Promise<{
    success: boolean;
    url?: string;
    message?: string;
  }>
  
  // 智能检测视频是否需要转码
  shouldTranscode: (inputUrl: string) => Promise<{
    success: boolean;
    shouldTranscode: boolean;
    reason?: string;
    codec?: string;
    width?: number;
    height?: number;
  }>
}

declare global {
  interface Window {
    electronAPI: ElectronApi,
  }
}
