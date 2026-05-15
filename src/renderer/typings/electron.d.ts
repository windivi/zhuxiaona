/**
 * Should match main/preload.ts for typescript support in renderer
 */

interface DesktopSourcePayload {
  id: string;
  name: string;
  display_id: string;
  thumbnail: string;
  appIcon: string | null;
}

export default interface ElectronApi {
  sendMessage: (message: string) => void;

  // 获取认证信息
  getAuthInfo: () => Promise<{
    cookies: string;
    csrfToken: string;
  }>;
  getDesktopCapturerSource: () => Promise<DesktopSourcePayload[]>,
  getLogs: () => Promise<any[]>,
  clearLogs: () => Promise<{ success: boolean; }>,
  onLogMessage: (callback: (log: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronApi,

  }
}
