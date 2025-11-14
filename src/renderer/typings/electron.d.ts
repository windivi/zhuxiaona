/**
 * Should match main/preload.ts for typescript support in renderer
 */
export default interface ElectronApi {
  sendMessage: (message: string) => void

  // 获取认证信息
  getAuthInfo: () => Promise<{
    cookies: string;
    csrfToken: string;
  }>
  getLogs: () => Promise<any[]>,
  clearLogs: () => Promise<{ success: boolean }>,
  onLogMessage: (callback: (log: any) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronApi,

  }
}
