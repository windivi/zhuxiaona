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

  /**
   * 初始化浏览器，使用系统的 Chrome 或 Chromium
   */
  async initBrowser(): Promise<void> {
    try {
      // 尝试常见的 Chrome/Chromium 路径
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH || '',
        // 如果上述都不可用，可以尝试使用 Electron 的 Chromium
        process.execPath
      ].filter(Boolean);

      let executablePath = '';
      
      // 尝试找到可用的浏览器
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
        headless: false, // 设置为 true 可以无头模式运行
        defaultViewport: {
          width: 1280,
          height: 800
        },
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

  /**
   * 自动登录并获取 cookie 和 csrf-token
   */
  async autoLogin(credentials: LoginCredentials): Promise<LoginResult> {
    if (!this.browser) {
      await this.initBrowser();
    }

    try {
      this.page = await this.browser!.newPage();
      
      // 设置用户代理
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 访问登录页面
      console.log('正在访问登录页面...');
      await this.page.goto('https://sxzy.chasinggroup.com/admin/auth/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 等待登录表单加载
      await this.page.waitForSelector('#login-form', { timeout: 10000 });
      console.log('登录页面已加载');

      // 填写用户名
      await this.page.type('input[name="username"]', credentials.username);
      console.log('已填写用户名');

      // 填写密码
      await this.page.type('input[name="password"]', credentials.password);
      console.log('已填写密码');

      // 填写动态码
      await this.page.type('input[name="code"]', credentials.dynamicCode);
      console.log('已填写动态码');

      // 点击登录按钮
      console.log('正在提交登录表单...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click('button[type="submit"].login-btn')
      ]);

      // 检查是否登录成功（通过URL变化或特定元素判断）
      const currentUrl = this.page.url();
      console.log('登录后的URL:', currentUrl);

      if (currentUrl.includes('/admin/auth/login')) {
        // 仍在登录页面，可能登录失败
        const errorElement = await this.page.$('.alert-danger, .help-block.with-errors');
        let errorMessage = '登录失败，请检查凭据';
        
        if (errorElement) {
          errorMessage = await this.page.evaluate(el => el.textContent, errorElement) || errorMessage;
        }
        
        return {
          success: false,
          cookies: '',
          csrfToken: '',
          error: errorMessage
        };
      }

      // 登录成功，等待首页数据请求
      console.log('登录成功，等待首页数据加载...');
      
      // 用于存储从API请求中获取的csrf token
      let csrfToken = '';
      
      // 监听网络请求，捕获列表数据请求
      const listApiCalled = new Promise<void>((resolve) => {
        // 监听请求，可能在请求头中有X-Xsrf-Token
        this.page!.on('request', (request) => {
          const url = request.url();
          if (url.includes('/admin/marketing/display/audit') || 
              url.includes('/admin') && (url.includes('audit') || url.includes('list'))) {
            console.log('检测到列表数据请求(请求):', url);
            
            // 从请求头中获取 X-Xsrf-Token
            const headers = request.headers();
            if (headers['x-xsrf-token']) {
              csrfToken = headers['x-xsrf-token'];
              console.log('从API请求头获取到 X-Xsrf-Token:', csrfToken);
            } else if (headers['x-csrf-token']) {
              csrfToken = headers['x-csrf-token'];
              console.log('从API请求头获取到 X-Csrf-Token:', csrfToken);
            }
          }
        });
        
      });

      // 尝试访问管理后台首页或列表页面，触发数据请求
      try {
        await this.page.goto('https://sxzy.chasinggroup.com/admin', {
          waitUntil: 'networkidle2',
          timeout: 15000
        });
      } catch (error) {
        console.log('访问管理后台可能超时，继续获取cookie...');
      }

      // 等待列表API调用或超时
      try {
        await Promise.race([
          listApiCalled,
          new Promise(resolve => setTimeout(resolve, 5000)) // 5秒超时
        ]);
      } catch (error) {
        console.log('等待API调用超时，继续获取cookie...');
      }

      // 获取所有 cookies
      const cookies = await this.page.cookies();
      console.log('获取到的cookies:', cookies);

      // 组装 cookie 字符串
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      // 尝试从页面中获取 csrf-token
      if (!csrfToken) {
        try {
          // 优先从 Dcat 对象获取 token
          csrfToken = await this.page.evaluate(() => {
            // 检查是否存在 Dcat 对象
            const win = window as any;
            if (typeof win.Dcat !== 'undefined' && win.Dcat.token) {
              return win.Dcat.token;
            }
            
            // 如果没有 Dcat，尝试从全局变量获取
            if (typeof win.CreateDcat !== 'undefined') {
              // 查找页面中的 Dcat 配置脚本
              const scripts = Array.from(document.scripts);
              for (const script of scripts) {
                const content = script.textContent || script.innerHTML;
                if (content.includes('CreateDcat') && content.includes('token')) {
                  // 尝试解析 token
                  const tokenMatch = content.match(/"token":\s*"([^"]+)"/);
                  if (tokenMatch && tokenMatch[1]) {
                    return tokenMatch[1];
                  }
                }
              }
            }
            
            return '';
          });
          
          if (csrfToken) {
            console.log('从 Dcat 对象获取到 CSRF Token:', csrfToken);
          } else {
            // 回退到其他方法
            // 方法1: 从meta标签获取
            csrfToken = await this.page.evaluate(() => {
              const metaToken = document.querySelector('meta[name="csrf-token"]');
              if (metaToken) {
                return metaToken.getAttribute('content') || '';
              }
              return '';
            });

            // 方法2: 如果meta标签没有，尝试从隐藏input获取
            if (!csrfToken) {
              csrfToken = await this.page.evaluate(() => {
                const tokenInput = document.querySelector('input[name="_token"]');
                if (tokenInput) {
                  return (tokenInput as HTMLInputElement).value || '';
                }
                return '';
              });
            }

            // 方法3: 从cookies中获取XSRF-TOKEN
            if (!csrfToken) {
              const xsrfCookie = cookies.find(cookie => cookie.name === 'XSRF-TOKEN');
              if (xsrfCookie) {
                csrfToken = decodeURIComponent(xsrfCookie.value);
              }
            }
            
            console.log('从页面/cookies获取的 CSRF Token:', csrfToken);
          }
        } catch (error) {
          console.error('获取 csrf-token 失败:', error);
        }
      }

      console.log('最终获取到的 CSRF Token:', csrfToken);

      return {
        success: true,
        cookies: cookieString,
        csrfToken,
      };

    } catch (error) {
      console.error('自动登录过程中发生错误:', error);
      return {
        success: false,
        cookies: '',
        csrfToken: '',
        error: error instanceof Error ? error.message : '未知错误'
      };
    } finally {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
    }
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('浏览器已关闭');
    }
  }

  /**
   * 监听特定的网络请求
   */
  private async waitForApiRequest(urlPattern: string, timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`等待API请求超时: ${urlPattern}`));
      }, timeout);

      const responseHandler = (response: any) => {
        if (response.url().includes(urlPattern)) {
          clearTimeout(timer);
          this.page!.off('response', responseHandler);
          resolve();
        }
      };

      this.page!.on('response', responseHandler);
    });
  }
}

// 导出单例实例
export const browserAutomation = new BrowserAutomation();