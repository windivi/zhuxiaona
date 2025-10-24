# 自动登录功能使用说明

## 功能概述

本项目集成了浏览器自动化功能，可以在 Electron 主进程中模拟浏览器行为，自动完成登录流程并获取认证信息（Cookie 和 CSRF Token）。

## 主要特性

1. **自动登录**: 模拟浏览器访问登录页面，自动填写表单并提交
2. **认证信息获取**: 登录成功后自动获取 Cookie 和 CSRF Token
3. **全局状态管理**: 获取的认证信息会自动设置到主进程的全局请求头中
4. **界面控制**: 提供友好的 UI 界面进行操作

## 核心文件

- `src/main/browserAutomation.ts` - 浏览器自动化核心模块
- `src/main/main.ts` - 主进程，集成自动化功能
- `src/main/preload.ts` - 预加载脚本，提供 API 接口
- `src/renderer/components/AutoLogin.vue` - 自动登录 UI 组件
- `src/renderer/typings/electron.d.ts` - TypeScript 类型定义

## 使用方法

### 1. 启动应用

```bash
yarn dev
```

### 2. 使用自动登录界面

1. 点击应用顶部的"显示自动登录"按钮
2. 填写登录凭据：
   - 用户名
   - 密码  
   - 6位动态码
3. 点击"开始自动登录"
4. 等待自动化流程完成

### 3. 编程方式调用

在渲染进程中可以直接调用 API：

```typescript
// 自动登录
const result = await window.electronAPI.autoLogin({
  username: '用户名',
  password: '密码',
  dynamicCode: '123456'
});

if (result.success) {
  console.log('登录成功');
  console.log('Cookies:', result.cookies);
  console.log('CSRF Token:', result.csrfToken);
}

// 获取当前认证信息
const authInfo = await window.electronAPI.getAuthInfo();
console.log('当前认证信息:', authInfo);

// 手动设置认证信息
await window.electronAPI.setAuthInfo({
  cookies: 'your-cookies-here',
  csrfToken: 'your-csrf-token-here'
});
```

## 工作流程

1. **启动浏览器**: 使用 puppeteer-core 启动系统 Chrome/Chromium
2. **访问登录页**: 导航到 `https://sxzy.chasinggroup.com/admin/auth/login`
3. **填写表单**: 自动填写用户名、密码和动态码
4. **提交登录**: 点击登录按钮并等待页面跳转
5. **监听请求**: 等待首页数据加载，监听 API 请求
6. **提取认证**: 从 Cookies 和页面中提取认证信息
7. **设置全局**: 将认证信息设置到主进程的请求头中

## 技术实现

### 主进程 IPC 处理器

```typescript
// 自动登录
ipcMain.handle('auto-login', async (event, credentials) => {
  const result = await browserAutomation.autoLogin(credentials);
  if (result.success) {
    cookieValue = result.cookies;
    csrfToken = result.csrfToken;
  }
  return result;
});

// 获取认证信息
ipcMain.handle('get-auth-info', () => {
  return { cookies: cookieValue, csrfToken: csrfToken };
});
```

### 请求拦截器

所有后续的 HTTP 请求都会自动携带获取到的认证信息：

```typescript
session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
  if (cookieValue) {
    details.requestHeaders['cookie'] = cookieValue;
  }
  if (csrfToken) {
    details.requestHeaders['x-csrf-token'] = csrfToken;
  }
  callback({ requestHeaders: details.requestHeaders });
});
```

## 配置说明

### 浏览器路径配置

系统会自动查找 Chrome/Chromium 浏览器，查找顺序：

1. `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`
2. `C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`
3. 用户目录下的 Chrome
4. 环境变量 `CHROME_PATH`
5. Electron 内置 Chromium

### 登录表单选择器

目标网站的表单字段：

- 用户名: `input[name="username"]`
- 密码: `input[name="password"]`
- 动态码: `input[name="code"]`
- 提交按钮: `button[type="submit"].login-btn`

## 注意事项

1. **动态码**: 动态码通常有时效性，需要及时输入
2. **网络环境**: 确保能正常访问目标网站
3. **浏览器版本**: 建议使用较新版本的 Chrome/Chromium
4. **安全性**: 本功能仅用于开发测试，请勿用于生产环境
5. **错误处理**: 如果登录失败，请检查凭据是否正确

## 故障排除

### 常见问题

1. **找不到浏览器**: 请安装 Chrome 浏览器或设置 `CHROME_PATH` 环境变量
2. **登录失败**: 检查用户名、密码和动态码是否正确
3. **网络超时**: 检查网络连接或增加超时时间
4. **页面元素找不到**: 目标网站可能更新了页面结构

### 调试模式

将 `browserAutomation.ts` 中的 `headless` 设置为 `false` 可以看到浏览器操作过程：

```typescript
this.browser = await launch({
  headless: false, // 显示浏览器窗口
  // ...其他配置
});
```

## API 参考

### 类型定义

```typescript
interface LoginCredentials {
  username: string;
  password: string;
  dynamicCode: string;
}

interface LoginResult {
  success: boolean;
  cookies: string;
  csrfToken: string;
  error?: string;
}
```

### 主要方法

- `autoLogin(credentials)` - 执行自动登录
- `getAuthInfo()` - 获取当前认证信息
- `setAuthInfo(authInfo)` - 设置认证信息
- `closeBrowserAutomation()` - 关闭浏览器