#!/usr/bin/env node

/**
 * 测试流式播放的行为
 * 模拟浏览器的 HEAD 和 GET 请求
 */

const http = require('http');

// 假设 transcode-server 运行在这个端口
const PORT = process.argv[2] || 23049;
const CACHE_ID = process.argv[3] || 'test-cache-id';

console.log(`\n测试流式播放行为...`);
console.log(`服务器: http://127.0.0.1:${PORT}`);
console.log(`缓存 ID: ${CACHE_ID}\n`);

/**
 * 执行 HEAD 请求（获取文件大小）
 */
function headRequest() {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${PORT}/file?id=${CACHE_ID}`;
    
    const req = http.request(url, {
      method: 'HEAD',
    }, (res) => {
      const contentLength = res.headers['content-length'];
      console.log(`📋 HEAD 响应:`);
      console.log(`  Content-Length: ${contentLength}`);
      console.log(`  Content-Type: ${res.headers['content-type']}`);
      console.log(`  Transfer-Encoding: ${res.headers['transfer-encoding'] || '(none)'}`);
      resolve(parseInt(contentLength || '0'));
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 执行 GET 请求（接收数据）
 */
function getRequest(expectedSize) {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${PORT}/file?id=${CACHE_ID}`;
    
    let receivedBytes = 0;
    let startTime = Date.now();
    let lastLogTime = startTime;
    let chunkCount = 0;

    const req = http.request(url, (res) => {
      console.log(`\n📥 GET 响应:`);
      console.log(`  Content-Length: ${res.headers['content-length'] || '(chunked)'}`);
      console.log(`  Transfer-Encoding: ${res.headers['transfer-encoding'] || '(none)'}`);
      console.log(`  Content-Type: ${res.headers['content-type']}`);
      console.log(`\n接收数据进度:`);

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        chunkCount++;

        const now = Date.now();
        if (now - lastLogTime >= 1000) { // 每秒打印一次
          const elapsed = (now - startTime) / 1000;
          const speed = (receivedBytes / 1024 / 1024 / elapsed).toFixed(2);
          const percent = expectedSize ? ((receivedBytes / expectedSize) * 100).toFixed(1) : '?';
          console.log(`  [${elapsed.toFixed(1)}s] ${(receivedBytes / 1024 / 1024).toFixed(2)}MB / ${(expectedSize / 1024 / 1024).toFixed(2)}MB (${percent}%) - ${speed} MB/s`);
          lastLogTime = now;
        }
      });

      res.on('end', () => {
        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`\n✅ 接收完成:`);
        console.log(`  总字节数: ${(receivedBytes / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  总耗时: ${totalTime.toFixed(2)}s`);
        console.log(`  分块数: ${chunkCount}`);
        console.log(`  平均速度: ${(receivedBytes / 1024 / 1024 / totalTime).toFixed(2)} MB/s`);
        resolve(receivedBytes);
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 主测试流程
 */
async function runTest() {
  try {
    // 首先执行 HEAD 请求
    console.log('=== 步骤 1: HEAD 请求 ===');
    const fileSize = await headRequest();
    
    // 然后执行 GET 请求
    console.log('\n=== 步骤 2: GET 请求 ===');
    const receivedSize = await getRequest(fileSize);

    // 总结
    console.log('\n=== 测试总结 ===');
    console.log(`HEAD 报告大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`GET 接收大小: ${(receivedSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`匹配度: ${fileSize === receivedSize ? '✅ 完全匹配' : '❌ 不匹配'}`);
    
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    process.exit(1);
  }
}

runTest();
