import * as http from 'http';
import { spawn } from 'child_process';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { net } from 'electron';

// 转码预设定义
interface TranscodePreset {
  name: string;
  preset: string;  // ffmpeg -preset 参数
  bitrate: string;  // 码率
  maxrate: string;  // 最高码率
  bufsize: string;  // 缓冲区大小
  description: string;
}

// 转码预设配置
const TRANSCODE_PRESETS: { [key: string]: TranscodePreset } = {
  'low': {
    name: '低速/高质量',
    preset: 'slow',
    bitrate: '2000k',
    maxrate: '2500k',
    bufsize: '5000k',
    description: '转码速度慢，但输出质量最好，适合对质量要求高的场景'
  },
  'medium': {
    name: '中速/中质量',
    preset: 'medium',
    bitrate: '1200k',
    maxrate: '1500k',
    bufsize: '3000k',
    description: '转码速度和质量的平衡，推荐使用'
  },
  'high': {
    name: '高速/低质量',
    preset: 'ultrafast',
    bitrate: '800k',
    maxrate: '1000k',
    bufsize: '2000k',
    description: '转码速度快，但输出质量较低，适合快速预览'
  }
};

// 全局转码配置
let transcodeConfig = {
  preset: 'low' as keyof typeof TRANSCODE_PRESETS,
  waitForComplete: false  // 默认流式播放模式：立即播放，进度条逐步增长
};

  // 缓存文件管理
class TranscodeCache {
  private cacheDir: string;
  private maxFiles: number = 5;
  private fileList: string[] = [];
  private transcodingFiles: Set<string> = new Set();  // 正在转码的文件
  
  // 缓存版本号 - 升级此值以清除所有旧缓存
  private CACHE_VERSION = '5';  // v5 = 添加 Accept-Ranges 和 Content-Range 头支持 seek

  constructor() {
    this.cacheDir = path.join(os.tmpdir(), 'transcode-cache');
    this.ensureCacheDir();
    this.loadFileList();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log('[transcode-cache] 创建缓存目录:', this.cacheDir);
    }
  }

  /**
   * 加载已有的缓存文件列表（程序启动时调用）
   * 这样即使重启应用也能找到之前的缓存
   */
  private loadFileList() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        console.log('[transcode-cache] 缓存目录中找到的文件:', files);
        
        this.fileList = files
          .filter(f => f.endsWith('.mp4') && f.startsWith('transcode-'))
          .map(f => path.join(this.cacheDir, f))
          .sort((a, b) => {
            try {
              return fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime();
            } catch (e) {
              return 0;
            }
          });
        
        console.log(`[transcode-cache] 加载了 ${this.fileList.length} 个缓存文件 (v${this.CACHE_VERSION})`);
      }
    } catch (e) {
      console.error('[transcode-cache] 加载文件列表失败:', e);
      this.fileList = [];
    }
  }

  /**
   * 生成缓存文件路径
   * @param sourceUrl 源视频 URL
   * @returns 缓存文件路径
   */
  getCachePath(sourceUrl: string): string {
    const hash = crypto.createHash('md5').update(sourceUrl).digest('hex');
    return path.join(this.cacheDir, `transcode-${hash}.mp4`);
  }

  /**
   * 获取缓存文件的相对ID（用于HTTP服务）
   */
  getCacheId(sourceUrl: string): string {
    const hash = crypto.createHash('md5').update(sourceUrl).digest('hex');
    return `transcode-${hash}.mp4`;
  }

  /**
   * 根据缓存ID获取完整路径
   */
  getFilePathById(cacheId: string): string | null {
    const filePath = path.join(this.cacheDir, cacheId);
    // 验证文件存在且是有效的 MP4 缓存文件
    if (fs.existsSync(filePath) && filePath.endsWith('.mp4') && cacheId.startsWith('transcode-')) {
      return filePath;
    }
    return null;
  }

  /**
   * 检查缓存文件是否存在
   */
  hasCached(sourceUrl: string): boolean {
    const cachePath = this.getCachePath(sourceUrl);
    const cacheId = this.getCacheId(sourceUrl);
    
    // 检查是否正在转码中
    if (this.transcodingFiles.has(cacheId)) {
      console.log('[transcode-cache] 🔄 文件正在转码中，不使用缓存:', cacheId);
      return false;
    }
    
    if (!fs.existsSync(cachePath)) {
      console.log('[transcode-cache] ❌ 缓存文件不存在:', cacheId);
      return false;
    }
    
    // 额外检查：确保文件大小 > 0（有效的视频文件）
    try {
      const stat = fs.statSync(cachePath);
      if (stat.size <= 1024) {
        console.log('[transcode-cache] ❌ 缓存文件过小（<1KB），可能损坏:', cacheId, '大小:', stat.size);
        return false;
      }
      console.log('[transcode-cache] ✅ 缓存文件有效:', cacheId, '大小:', (stat.size / 1024 / 1024).toFixed(2), 'MB');
      return true;
    } catch (e) {
      console.log('[transcode-cache] ❌ 缓存文件读取失败:', cacheId, e);
      return false;
    }
  }

  /**
   * 标记文件开始转码
   */
  markTranscodingStart(sourceUrl: string): void {
    const cacheId = this.getCacheId(sourceUrl);
    this.transcodingFiles.add(cacheId);
    console.log('[transcode-cache] 标记转码开始:', cacheId);
  }

  /**
   * 标记文件转码完成
   */
  markTranscodingComplete(sourceUrl: string): void {
    const cacheId = this.getCacheId(sourceUrl);
    this.transcodingFiles.delete(cacheId);
    console.log('[transcode-cache] 标记转码完成:', cacheId);
  }

  /**
   * 检查文件是否正在转码中
   */
  isTranscoding(cacheId: string): boolean {
    return this.transcodingFiles.has(cacheId);
  }

  /**
   * 清除所有缓存文件（用于版本升级）
   */
  clearAllCache(): void {
    console.log('[transcode-cache] 🗑️  清除所有缓存文件...');
    for (const filePath of this.fileList) {
      try {
        fs.unlinkSync(filePath);
        console.log('[transcode-cache] ✓ 已删除:', path.basename(filePath));
      } catch (e) {
        console.error('[transcode-cache] 删除文件失败:', filePath, e);
      }
    }
    this.fileList = [];
    console.log('[transcode-cache] 缓存清除完成');
  }

  /**
   * 添加文件到缓存（使用滑动窗口策略，最多保留5个文件）
   */
  addFile(filePath: string): void {
    if (!this.fileList.includes(filePath)) {
      this.fileList.push(filePath);
    }

    // 如果超过最大数量，删除最老的文件
    while (this.fileList.length > this.maxFiles) {
      const oldestFile = this.fileList.shift();
      if (oldestFile && oldestFile !== filePath) {
        try {
          fs.unlinkSync(oldestFile);
          console.log('[transcode-cache] Deleted oldest cached file:', path.basename(oldestFile));
        } catch (e) {
          console.error('[transcode-cache] Error deleting file:', oldestFile, e);
        }
      }
    }

    console.log(`[transcode-cache] Cache now contains ${this.fileList.length}/${this.maxFiles} files`);
  }

  /**
   * 获取缓存目录
   */
  getCacheDir(): string {
    return this.cacheDir;
  }
}

const transcodeCache = new TranscodeCache();

export function startTranscodeServer(hwAccelType: string | null): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    // 清除所有旧缓存（使用新的 ffmpeg 参数重新转码）
    console.log('[transcode-server] ⚠️  清除旧版本缓存，强制使用新转码参数...');
    transcodeCache.clearAllCache();

    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) { res.writeHead(400); res.end('Bad Request'); return; }
        const full = new URL(req.url, `http://127.0.0.1`);
        
        // 处理各种请求
        if (full.pathname.startsWith('/transcode')) {
          handleTranscodeRequest(full, res, hwAccelType);
        } else if (full.pathname.startsWith('/file')) {
          // /file 端点支持 HEAD 和 GET
          if (req.method === 'HEAD') {
            handleFileHeadRequest(full, res);
          } else {
            handleFileRequest(full, res);
          }
        } else if (full.pathname === '/clear-cache' && req.method === 'POST') {
          handleClearCache(res);
        } else if (full.pathname === '/cache-info' && req.method === 'GET') {
          handleCacheInfo(res);
        } else if (full.pathname === '/set-wait-mode' && req.method === 'POST') {
          handleSetWaitMode(req, res);
        } else if (full.pathname === '/config' && req.method === 'GET') {
          handleGetConfig(res);
        } else if (full.pathname === '/presets' && req.method === 'GET') {
          handleGetPresets(res);
        } else if (full.pathname === '/set-preset' && req.method === 'POST') {
          handleSetPreset(req, res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      } catch (err) {
        console.error('[transcode-server] Request handler error:', err);
        res.writeHead(500);
        res.end('server error');
      }
    });

    server.on('error', (err) => {
      console.error('[transcode-server] Server error:', err);
      reject(err);
    });

    server.listen(0, '127.0.0.1', () => {
      // @ts-ignore
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        console.log('[transcode-server] Server listening on port:', addr.port);
        console.log('[transcode-server] 缓存版本: v' + (transcodeCache as any).CACHE_VERSION);
        resolve(addr.port);
      } else {
        reject(new Error('failed to get server port'));
      }
    });
  });
}

/**
 * 处理转码请求 - 返回缓存文件ID
 */
function handleTranscodeRequest(full: URL, res: http.ServerResponse, hwAccelType: string | null) {
  const input = full.searchParams.get('url') || '';
  if (!input) { res.writeHead(400); res.end('missing url param'); return; }
  if (!/^https?:\/\//i.test(input)) { res.writeHead(400); res.end('only http(s) urls are allowed'); return; }

  console.log('[transcode-server] ⏳ 新转码请求:', input.substring(0, 100) + '...');

  // 检查缓存
  if (transcodeCache.hasCached(input)) {
    const cacheId = transcodeCache.getCacheId(input);
    console.log('[transcode-server] ✅ 缓存命中!', '缓存ID:', cacheId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, cacheId: cacheId }));
    return;
  }

  console.log('[transcode-server] 🆕 缓存未命中，开始新的转码...');

  // 标记文件开始转码（防止其他请求使用未完成的文件）
  const cacheId = transcodeCache.getCacheId(input);
  transcodeCache.markTranscodingStart(input);
  console.log('[transcode-server] 🔒 已标记转码开始，cacheId:', cacheId);

  // 生成临时文件和输出文件路径
  const tempDir = os.tmpdir();
  const tempDownloadFile = path.join(tempDir, `transcode-download-${Date.now()}.tmp`);
  const outputFile = transcodeCache.getCachePath(input);

  console.log('[transcode-server] 📥 下载到临时文件:', tempDownloadFile);

  // 下载视频
  downloadToFileElectronNet(input, tempDownloadFile, async (err) => {
    if (err) {
      console.error('[transcode-server] ❌ 下载失败:', err.message);
      transcodeCache.markTranscodingComplete(input);
      console.log('[transcode-server] 🔓 因下载失败，已标记转码结束');
      try { fs.unlinkSync(tempDownloadFile); } catch (e) { }
      
      // 只在响应还未发送时才返回错误
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Download failed' }));
      }
      return;
    }

    console.log('[transcode-server] ✅ 下载完成，开始 ffmpeg 转码...');

    // 转码视频
    transcodeVideo(tempDownloadFile, outputFile, hwAccelType, (transcodeErr) => {
      // 删除临时下载文件
      try { fs.unlinkSync(tempDownloadFile); } catch (e) { }

      if (transcodeErr) {
        console.error('[transcode-server] ❌ 转码失败:', transcodeErr.message);
        transcodeCache.markTranscodingComplete(input);
        console.log('[transcode-server] 🔓 因转码失败，已标记转码结束');
        try { fs.unlinkSync(outputFile); } catch (e) { }
        
        // 只在等待完成模式下才返回错误（流式模式已经返回了）
        if (transcodeConfig.waitForComplete && !res.headersSent) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: 'Transcode failed' }));
        }
        return;
      }

      console.log('[transcode-server] ✅ ffmpeg 转码完成!');
      
      // 添加到缓存管理
      transcodeCache.addFile(outputFile);
      
      // 标记文件转码完成
      transcodeCache.markTranscodingComplete(input);
      console.log('[transcode-server] 🔓 转码成功，已标记转码结束，cacheId:', cacheId);

      // 在等待完成模式下，返回缓存ID给前端
      if (transcodeConfig.waitForComplete && !res.headersSent) {
        console.log('[transcode-server] 📤 等待完成模式：返回缓存ID');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, cacheId: cacheId }));
      } else if (transcodeConfig.waitForComplete) {
        console.log('[transcode-server] ⚠️  等待完成模式下，但响应已发送，cacheId:', cacheId);
      } else {
        console.log('[transcode-server] ℹ️  流式模式下转码完成，响应已提前返回');
      }
    });

    // 在流式模式下，等待文件开始被创建，然后立即返回（不等待转码完成）
    if (!transcodeConfig.waitForComplete) {
      console.log('[transcode-server] ⏳ 流式模式：等待输出文件出现...');
      let waitCount = 0;
      const maxWaitTime = 30000; // 最多等待 30 秒
      const checkInterval = 50; // 每 50ms 检查一次
      const maxChecks = maxWaitTime / checkInterval;

      const checkFileExists = () => {
        if (fs.existsSync(outputFile)) {
          const stat = fs.statSync(outputFile);
          console.log(`[transcode-server] 📤 流式模式：文件已出现（${(stat.size / 1024).toFixed(2)}KB），立即返回 cacheId`);
          if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, cacheId: cacheId }));
          }
          return;
        }

        waitCount++;
        if (waitCount > maxChecks) {
          console.error('[transcode-server] ❌ 等待输出文件超时');
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: 'Output file creation timeout' }));
          }
          return;
        }

        setTimeout(checkFileExists, checkInterval);
      };

      checkFileExists();
    }
  });
}

/**
 * 处理 HEAD 请求 - 返回文件元数据而不传输内容
 * 浏览器用这个请求来确定文件总大小和时长
 */
function handleFileHeadRequest(full: URL, res: http.ServerResponse) {
  const cacheId = full.searchParams.get('id');
  if (!cacheId) { res.writeHead(400); res.end('missing id param'); return; }

  const filePath = transcodeCache.getFilePathById(cacheId);
  if (!filePath) {
    res.writeHead(404);
    res.end('Cache file not found');
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end();
      console.log(`[transcode-server] 📋 HEAD 请求：${(stat.size / 1024 / 1024).toFixed(2)}MB (cacheId: ${cacheId})`);
    } else {
      res.writeHead(404);
      res.end('File not found');
    }
  } catch (err) {
    console.error('[transcode-server] ❌ HEAD 请求错误:', err);
    res.writeHead(500);
    res.end('Server error');
  }
}

/**
 * 处理文件请求 - 直接返回文件内容
 * 根据 waitForComplete 配置决定是否等待转码完成
 * - waitForComplete=true: 等待完成后再返回（最多 120 秒）
 * - waitForComplete=false: 边转码边返回（流式模式，等待初始数据）
 */
function handleFileRequest(full: URL, res: http.ServerResponse) {
  const cacheId = full.searchParams.get('id');
  if (!cacheId) { res.writeHead(400); res.end('missing id param'); return; }

  console.log('[transcode-server] 📥 文件请求，缓存ID:', cacheId, '模式:', transcodeConfig.waitForComplete ? '等待完成' : '流式播放');

  // 获取缓存文件路径
  const filePath = transcodeCache.getFilePathById(cacheId);
  if (!filePath) {
    console.error('[transcode-server] ❌ 缓存文件不存在:', cacheId);
    res.writeHead(404);
    res.end('Cache file not found');
    return;
  }

  // 根据配置决定等待策略
  if (!transcodeConfig.waitForComplete) {
    // 流式播放模式：等待初始数据（至少 100KB），然后立即返回边转码边播放的文件
    waitForInitialData(filePath, cacheId, res);
    return;
  }

  // 等待完成模式：等待转码完成后再返回（最多 120 秒，每 100ms 检查一次）
  let waitCount = 0;
  const maxWaitTime = 120000; // 120 秒
  const checkInterval = 100; // 每 100ms 检查一次
  const maxChecks = maxWaitTime / checkInterval;

  const checkAndServeFile = () => {
    // 检查文件是否仍在转码中
    if (transcodeCache.isTranscoding(cacheId)) {
      waitCount++;
      if (waitCount === 1) {
        console.log('[transcode-server] ⏳ 文件仍在转码中，等待完成...', cacheId);
      }
      if (waitCount % 10 === 0) {
        console.log(`[transcode-server] ⏳ 仍在等待转码完成... (${(waitCount * checkInterval / 1000).toFixed(1)}s)`);
      }
      if (waitCount > maxChecks) {
        console.error('[transcode-server] ❌ 等待超时，转码未能及时完成');
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Transcode timeout' }));
        return;
      }
      setTimeout(checkAndServeFile, checkInterval);
      return;
    }

    // 转码已完成，现在返回完整文件
    if (waitCount > 0) {
      console.log('[transcode-server] ✅ 转码完成，开始返回文件...', cacheId);
    }

    serveCompleteFile(filePath, cacheId, res);
  };

  // 开始检查和等待
  checkAndServeFile();
}

/**
 * 等待初始数据然后流式返回（用于流式播放模式）
 * 关键：等待足够的数据量后，检测转码进度，最快地返回可播放的文件
 */
function waitForInitialData(filePath: string, cacheId: string, res: http.ServerResponse) {
  const minInitialSize = 50 * 1024; // 至少 50KB 就可以开始播放
  let waitCount = 0;
  const maxWaitTime = 120000; // 最多等待 120 秒
  const checkInterval = 50; // 每 50ms 检查一次
  const maxChecks = maxWaitTime / checkInterval;
  let hasEnoughData = false;

  const checkInitialData = () => {
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        
        if (!hasEnoughData && stat.size >= minInitialSize) {
          hasEnoughData = true;
          console.log('[transcode-server] ✅ 初始数据就绪（' + (stat.size / 1024).toFixed(2) + 'KB），检测文件稳定...');
          // 初始数据就绪，开始检测文件是否稳定（500ms 无增长）
          waitForFileStable(filePath, cacheId, res);
          return;
        }
      }

      waitCount++;
      if (waitCount === 1) {
        console.log('[transcode-server] ⏳ 等待初始数据（至少50KB）...', cacheId);
      }
      if (waitCount % 20 === 0) {
        const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        console.log(`[transcode-server] ⏳ 初始数据仍不足... (${(size / 1024).toFixed(2)}KB)`);
      }

      if (waitCount > maxChecks) {
        console.error('[transcode-server] ❌ 等待超时');
        res.writeHead(504);
        res.end('Timeout');
        return;
      }

      setTimeout(checkInitialData, checkInterval);
    } catch (err) {
      console.error('[transcode-server] ❌ 错误:', err);
      res.writeHead(500);
      res.end('Error');
    }
  };

  checkInitialData();
}

/**
 * 等待文件稳定（500ms 内没有增长）
 * 一旦稳定就返回准确的 Content-Length，这样浏览器可以正确显示时长
 */
function waitForFileStable(filePath: string, cacheId: string, res: http.ServerResponse) {
  let lastSize = 0;
  let noGrowthMs = 0;
  const checkInterval = 50;
  const stableThreshold = 500; // 500ms 没有增长就认为稳定
  let checkCount = 0;

  const check = () => {
    try {
      if (!fs.existsSync(filePath)) {
        setTimeout(check, checkInterval);
        return;
      }

      const stat = fs.statSync(filePath);
      const sizeDelta = stat.size - lastSize;

      if (sizeDelta === 0) {
        // 没有增长
        noGrowthMs += checkInterval;
        if (noGrowthMs >= stableThreshold) {
          console.log(`[transcode-server] 📤 文件稳定（500ms 无增长），立即返回 ${(stat.size / 1024 / 1024).toFixed(2)}MB`);
          serveStreamingFile(filePath, cacheId, res, stat.size);
          return;
        }
      } else {
        // 有增长，重置计数
        noGrowthMs = 0;
        lastSize = stat.size;
        checkCount++;
        
        if (checkCount % 10 === 0) {
          const speed = sizeDelta / (checkInterval / 1000) / 1024;
          console.log(`[transcode-server] ⏳ 文件增长中... (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
        }
      }

      setTimeout(check, checkInterval);
    } catch (err) {
      console.error('[transcode-server] ❌ 错误:', err);
      res.writeHead(500);
      res.end('Error');
    }
  };

  check();
}

/**
 * 流式返回正在转码的文件
 * 返回准确的 Content-Length，浏览器可以计算时长并播放
 */
function serveStreamingFile(filePath: string, cacheId: string, res: http.ServerResponse, expectedSize?: number) {
  try {
    const stat = fs.statSync(filePath);
    const contentLength = expectedSize || stat.size;

    // 返回准确的 Content-Length
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': contentLength,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = fs.createReadStream(filePath);
    let totalBytes = 0;

    stream.on('data', (chunk) => {
      totalBytes += chunk.length;
      res.write(chunk);
    });

    stream.on('end', () => {
      res.end();
      console.log(`[transcode-server] ✅ 流式传输完成：${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
    });

    stream.on('error', (err) => {
      console.error('[transcode-server] ❌ 错误:', err);
      res.end();
    });

    console.log(`[transcode-server] 📤 开始返回文件：${(contentLength / 1024 / 1024).toFixed(2)}MB (cacheId: ${cacheId})`);
  } catch (err) {
    console.error('[transcode-server] ❌ 错误:', err);
    res.writeHead(500);
    res.end('Error');
  }
}

/**
 * 返回完整文件（用于等待完成模式）
 */
function serveCompleteFile(filePath: string, cacheId: string, res: http.ServerResponse) {
  try {
    const fileSize = fs.statSync(filePath).size;
    console.log('[transcode-server] ✅ 返回完整文件:', filePath, `大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': fileSize,
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('[transcode-server] ❌ 文件读取错误:', err);
      try { res.writeHead(500); res.end('Error reading file'); } catch (e) { }
    });
  } catch (err) {
    console.error('[transcode-server] ❌ 文件请求处理错误:', err);
    try { res.writeHead(500); res.end('Server error'); } catch (e) { }
  }
}

/**
 * 清除所有缓存 - POST /clear-cache
 */
function handleClearCache(res: http.ServerResponse) {
  try {
    console.log('[transcode-server] 🗑️  收到清除缓存请求');
    transcodeCache.clearAllCache();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: '缓存已清除' }));
  } catch (err) {
    console.error('[transcode-server] 清除缓存失败:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: String(err) }));
  }
}

/**
 * 获取缓存信息 - GET /cache-info
 */
function handleCacheInfo(res: http.ServerResponse) {
  try {
    // 获取缓存目录信息
    const cacheDir = require('path').join(require('os').tmpdir(), 'transcode-cache');
    let totalSize = 0;
    let fileCount = 0;

    if (require('fs').existsSync(cacheDir)) {
      const files = require('fs').readdirSync(cacheDir);
      fileCount = files.length;
      
      for (const file of files) {
        try {
          const filePath = require('path').join(cacheDir, file);
          const stat = require('fs').statSync(filePath);
          totalSize += stat.size;
        } catch (e) {
          // 忽略单个文件错误
        }
      }
    }

    console.log('[transcode-server] 📊 缓存信息 - 文件数:', fileCount, '总大小:', totalSize);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      fileCount: fileCount,
      totalSize: totalSize 
    }));
  } catch (err) {
    console.error('[transcode-server] 获取缓存信息失败:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: String(err) }));
  }
}

/**
 * 设置等待模式 - POST /set-wait-mode
 */
function handleSetWaitMode(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = '';
  
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
    if (body.length > 1e6) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
      req.socket.destroy();
    }
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const waitForComplete = data.waitForComplete === true;
      
      console.log('[transcode-server] ⚙️  设置等待模式:', waitForComplete ? '等待完成' : '流式播放');
      
      // 更新全局配置
      transcodeConfig.waitForComplete = waitForComplete;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: `已切换到${waitForComplete ? '等待完成' : '流式播放'}模式`,
        waitForComplete: waitForComplete
      }));
    } catch (err) {
      console.error('[transcode-server] 设置等待模式失败:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: String(err) }));
    }
  });
}

/**
 * 获取当前配置 - GET /config
 */
function handleGetConfig(res: http.ServerResponse) {
  try {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      waitForComplete: transcodeConfig.waitForComplete,
      preset: transcodeConfig.preset
    }));
  } catch (err) {
    console.error('[transcode-server] 获取配置失败:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: String(err) }));
  }
}

/**
 * 获取转码预设列表 - GET /presets
 */
function handleGetPresets(res: http.ServerResponse) {
  try {
    const presets = Object.entries(TRANSCODE_PRESETS).map(([key, preset]) => ({
      key,
      ...preset,
      isActive: transcodeConfig.preset === key
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      presets: presets,
      currentPreset: transcodeConfig.preset
    }));
  } catch (err) {
    console.error('[transcode-server] 获取预设失败:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: String(err) }));
  }
}

/**
 * 设置转码预设 - POST /set-preset
 */
function handleSetPreset(req: http.IncomingMessage, res: http.ServerResponse) {
  let body = '';
  
  req.on('data', (chunk: Buffer) => {
    body += chunk.toString();
    if (body.length > 1e6) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
      req.socket.destroy();
    }
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const presetKey = data.preset as keyof typeof TRANSCODE_PRESETS;
      
      if (!TRANSCODE_PRESETS[presetKey]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '无效的预设' }));
        return;
      }
      
      transcodeConfig.preset = presetKey;
      const preset = TRANSCODE_PRESETS[presetKey];
      
      console.log('[transcode-server] 📊 设置转码预设:', preset.name);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: `已切换到${preset.name}预设`,
        preset: presetKey,
        presetInfo: preset
      }));
    } catch (err) {
      console.error('[transcode-server] 设置预设失败:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: String(err) }));
    }
  });
}

/**
 * 转码视频
 */
function transcodeVideo(
  inputFile: string,
  outputFile: string,
  hwAccelType: string | null,
  callback: (err?: Error) => void
) {
  const startTime = Date.now();
  console.log('[transcode-server] 转码开始: 输入文件:', inputFile, '输出文件:', outputFile);

  // 获取当前预设配置
  const preset = TRANSCODE_PRESETS[transcodeConfig.preset];
  console.log('[transcode-server] 使用预设:', preset.name);

  const args: string[] = [
    '-hide_banner', '-loglevel', 'warning'
  ];

  // 添加硬件加速参数
  if (hwAccelType) {
    args.push('-hwaccel', hwAccelType);
    args.push('-hwaccel_output_format', hwAccelType);
  }

  // 添加输入文件和转码参数（使用预设中的配置）
  args.push(
    '-i', inputFile,
    '-c:v', 'libx264',
    '-preset', preset.preset,
    '-tune', 'zerolatency',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-b:v', preset.bitrate,
    '-maxrate', preset.maxrate,
    '-bufsize', preset.bufsize,
    '-g', '30',
    '-keyint_min', '30',
    '-vf', 'scale=min(iw\\,1280):-2',
    '-r', '25',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ar', '44100',
    '-ac', '2',
    '-f', 'mp4'
  );

  // 根据播放模式选择 movflags 参数
  // 两种模式都使用 faststart，这样生成的 MP4 文件从一开始就是可播放的
  args.push('-movflags', 'faststart');
  
  if (transcodeConfig.waitForComplete) {
    console.log('[transcode-server] 转码模式: 等待完成（使用faststart，确保MP4可播放）');
  } else {
    console.log('[transcode-server] 转码模式: 流式播放（使用faststart，确保初期文件可播放）');
  }

  args.push(outputFile);

  let ffmpeg: any = null;
  try { ffmpeg = spawn('ffmpeg', args, { windowsHide: true }); }
  catch (e) {
    console.error('[transcode-server] Failed to spawn ffmpeg:', e);
    callback(e as Error);
    return;
  }

  let errorLog = '';
  let progressLog = '';
  
  ffmpeg.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    errorLog += text;
    progressLog += text;
    // 打印 ffmpeg 进度
    if (progressLog.includes('frame=') || progressLog.includes('speed=')) {
      console.log('[ffmpeg]', progressLog.trim());
      progressLog = '';
    }
  });

  ffmpeg.on('error', (err: any) => {
    console.error('[transcode-server] ffmpeg spawn error:', err);
    callback(err);
  });

  ffmpeg.on('close', (code: number, signal: string) => {
    const elapsedTime = Date.now() - startTime;
    if (code !== 0 && code !== null) {
      console.error(`[transcode-server] ffmpeg 失败: 退出代码 ${code}, 信号: ${signal}, 耗时: ${elapsedTime}ms`);
      console.error('[transcode-server] 错误详情:', errorLog);
      callback(new Error(`ffmpeg exited with code ${code}`));
    } else {
      // 验证输出文件是否存在
      try {
        const stat = fs.statSync(outputFile);
        console.log(`[transcode-server] ffmpeg 转码成功! 耗时: ${elapsedTime}ms, 输出文件大小: ${stat.size} bytes`);
      } catch (e) {
        console.warn('[transcode-server] 转码似乎完成，但找不到输出文件:', outputFile);
      }
      callback();
    }
  });
}

/**
 * 从远程URL下载视频到本地临时文件（使用Electron的net模块）
 */
function downloadToFileElectronNet(urlString: string, filePath: string, callback: (err?: Error) => void) {
  const writeStream = fs.createWriteStream(filePath);

  const makeRequest = (url: string, retries = 0) => {
    if (retries > 3) {
      callback(new Error('Max retries exceeded'));
      return;
    }

    console.log(`[transcode-server] Fetching URL (attempt ${retries + 1}):`, url);

    // 使用 Electron 的 net 模块（有完整的浏览器身份信息）
    const request = net.request({
      url: url,
      method: 'GET',
      redirect: 'follow',  // 自动跟随重定向
    });

    let timeoutHandle: NodeJS.Timeout | null = null;

    request.on('response', (response) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);

      console.log('[transcode-server] Response status:', response.statusCode);

      if (response.statusCode! >= 200 && response.statusCode! < 300) {
        console.log('[transcode-server] Starting download');

        // 使用事件监听而不是 pipe
        response.on('data', (chunk: Buffer) => {
          writeStream.write(chunk);
        });

        response.on('end', () => {
          writeStream.end();
        });

        response.on('error', (err: any) => {
          console.error('[transcode-server] Response error:', err);
          writeStream.destroy();
          try { fs.unlinkSync(filePath); } catch (e) { }
          callback(err);
        });
      } else {
        console.error('[transcode-server] HTTP error:', response.statusCode);
        writeStream.destroy();
        try { fs.unlinkSync(filePath); } catch (e) { }
        if (retries < 2) {
          setTimeout(() => makeRequest(url, retries + 1), 1000 + Math.random() * 1000);
        } else {
          callback(new Error(`HTTP ${response.statusCode}`));
        }
      }
    });

    request.on('error', (err: any) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      console.error('[transcode-server] Request error:', err.message || err, 'code:', err.code);
      writeStream.destroy();
      try { fs.unlinkSync(filePath); } catch (e) { }

      const retryableErrors = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'];
      if (retryableErrors.includes(err.code) && retries < 3) {
        const delay = (retries + 1) * (1000 + Math.random() * 1000);
        console.log(`[transcode-server] Retrying after ${delay}ms...`);
        setTimeout(() => makeRequest(url, retries + 1), delay);
      } else {
        callback(err);
      }
    });

    // 设置超时
    timeoutHandle = setTimeout(() => {
      console.error('[transcode-server] Request timeout');
      request.abort();
      writeStream.destroy();
      try { fs.unlinkSync(filePath); } catch (e) { }
      if (retries < 2) {
        setTimeout(() => makeRequest(url, retries + 1), 1000);
      } else {
        callback(new Error('Timeout'));
      }
    }, 30000);

    request.end();
  };

  writeStream.on('error', (err) => {
    console.error('[transcode-server] Write stream error:', err);
    callback(err);
  });

  writeStream.on('finish', () => {
    console.log('[transcode-server] File download finished');
    callback();
  });

  makeRequest(urlString);
}
