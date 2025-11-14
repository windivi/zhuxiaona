import { launch, Browser, Page } from 'puppeteer-core';
import { app } from 'electron';
import * as path from 'path';

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

export class BrowserAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initBrowser(): Promise<void> {
    try {
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH || '',
        process.execPath
      ].filter(Boolean);

      let executablePath = '';
      for (const path of possiblePaths) {
        try {
          const fs = require('fs');
          if (fs.existsSync(path)) {
            executablePath = path;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!executablePath) {
        throw new Error('未找到可用的 Chrome/Chromium 浏览器');
      }

      console.log('使用浏览器路径:', executablePath);
      this.browser = await launch({
        executablePath: executablePath,
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      console.log('浏览器已启动');
    } catch (error) {
      console.error('启动浏览器失败:', error);
      throw error;
    }
  }

  async autoLogin(credentials: LoginCredentials): Promise<LoginResult> {
    if (!this.browser) {
      await this.initBrowser();
    }

    try {
      this.page = await this.browser!.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      console.log('正在访问登录页面...');
      await this.page.goto('https://sxzy.chasinggroup.com/admin/auth/login', { waitUntil: 'networkidle2', timeout: 30000 });
      await this.page.waitForSelector('#login-form', { timeout: 10000 });
      await this.page.type('input[name="username"]', credentials.username);
      await this.page.type('input[name="password"]', credentials.password);
      await this.page.type('input[name="code"]', credentials.dynamicCode);
      console.log('正在提交登录表单...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click('button[type="submit"].login-btn')
      ]);

      const currentUrl = this.page.url();
      console.log('登录后的URL:', currentUrl);

      if (currentUrl.includes('/admin/auth/login')) {
        const errorElement = await this.page.$('.alert-danger, .help-block.with-errors');
        let errorMessage = '登录失败，请检查凭据';
        if (errorElement) {
          errorMessage = await this.page.evaluate(el => el.textContent, errorElement) || errorMessage;
        }
        return { success: false, cookies: '', csrfToken: '', error: errorMessage };
      }

      console.log('登录成功，等待首页数据加载...');
      let csrfToken = '';
      const listApiCalled = new Promise<void>((resolve) => {
        this.page!.on('request', (request) => {
          const url = request.url();
          if (url.includes('/admin/marketing/display/audit') || (url.includes('/admin') && (url.includes('audit') || url.includes('list')))) {
            const headers = request.headers();
            if (headers['x-xsrf-token']) csrfToken = headers['x-xsrf-token'];
            else if (headers['x-csrf-token']) csrfToken = headers['x-csrf-token'];
          }
        });
      });

      try { await this.page.goto('https://sxzy.chasinggroup.com/admin', { waitUntil: 'networkidle2', timeout: 15000 }); } catch (error) { console.log('访问管理后台可能超时，继续获取cookie...'); }

      try { await Promise.race([listApiCalled, new Promise(resolve => setTimeout(resolve, 5000))]); } catch (error) { console.log('等待API调用超时，继续获取cookie...'); }

      const cookies = await this.page.cookies();
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      if (!csrfToken) {
        try {
          csrfToken = await this.page.evaluate(() => {
            const win = window as any;
            if (typeof win.Dcat !== 'undefined' && win.Dcat.token) return win.Dcat.token;
            if (typeof win.CreateDcat !== 'undefined') {
              const scripts = Array.from(document.scripts);
              for (const script of scripts) {
                const content = script.textContent || script.innerHTML;
                if (content.includes('CreateDcat') && content.includes('token')) {
                  const tokenMatch = content.match(/"token":\s*"([^"]+)"/);
                  if (tokenMatch && tokenMatch[1]) return tokenMatch[1];
                }
              }
            }
            return '';
          });
          if (!csrfToken) {
            csrfToken = await this.page.evaluate(() => {
              const metaToken = document.querySelector('meta[name="csrf-token"]');
              return metaToken ? (metaToken.getAttribute('content') || '') : '';
            });
            if (!csrfToken) {
              csrfToken = await this.page.evaluate(() => {
                const tokenInput = document.querySelector('input[name="_token"]');
                return tokenInput ? (tokenInput as HTMLInputElement).value || '' : '';
              });
            }
            if (!csrfToken) {
              const xsrfCookie = cookies.find(cookie => cookie.name === 'XSRF-TOKEN');
              if (xsrfCookie) csrfToken = decodeURIComponent(xsrfCookie.value);
            }
          }
        } catch (error) {
          console.error('获取 csrf-token 失败:', error);
        }
      }

      console.log('最终获取到的 CSRF Token:', csrfToken);
      return { success: true, cookies: cookieString, csrfToken };

    } catch (error) {
      console.error('自动登录过程中发生错误:', error);
      return { success: false, cookies: '', csrfToken: '', error: error instanceof Error ? error.message : '未知错误' };
    } finally {
      await browserAutomation.closeBrowser()
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) { await this.browser.close(); this.browser = null; console.log('浏览器已关闭'); }
  }

  private async waitForApiRequest(urlPattern: string, timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { reject(new Error(`等待API请求超时: ${urlPattern}`)); }, timeout);
      const responseHandler = (response: any) => {
        if (response.url().includes(urlPattern)) { clearTimeout(timer); this.page!.off('response', responseHandler); resolve(); }
      };
      this.page!.on('response', responseHandler);
    });
  }
}

export const browserAutomation = new BrowserAutomation();
