# 流式播放模式诊断指南

## 问题症状
流式播放模式（边转码边播放）无法正常启用。

## 工作原理

### 等待完成模式（waitForComplete=true）
1. 前端请求转码：`POST /transcode?url=...`
2. 后端开始转码，使用 ffmpeg `-movflags faststart` 参数
3. 后端等待转码完全完成
4. 前端请求文件：`GET /file?id=...`
5. 后端返回**完整**文件，设置 `Content-Length`
6. 浏览器完整接收后播放

### 流式播放模式（waitForComplete=false）
1. 前端请求转码：`POST /transcode?url=...`
2. 后端开始转码，**不使用** ffmpeg `-movflags faststart` 参数
3. 后端立即返回 cacheId（不等待）
4. 前端请求文件：`GET /file?id=...`
5. 后端**等待初始数据**（50KB）生成，然后立即返回
6. 浏览器使用 `Transfer-Encoding: chunked` 持续接收数据（没有 Content-Length）
7. 边接收边播放

## 诊断步骤

### 1. 验证配置已保存
- 打开"转码配置"面板
- 查看"播放模式配置"部分
- 选择"边转码边播放"模式
- 应该看到消息："已切换：边转码边播放"

**检查后端日志**（开发者工具 → 控制台）：
```
[transcode-server] ⚙️  设置等待模式: 流式播放
```

### 2. 验证新转码使用了正确的参数
当选择流式模式后，**清除缓存**再进行新的转码。

**第一步：清除缓存**
- 在转码配置面板中，点击"清除所有缓存"
- 应该看到消息："缓存已清除"

**第二步：触发新转码**
- 播放一个需要转码的视频（H.265 或其他格式）
- 查看后端日志，应该看到：
```
[transcode-server] 转码模式: 流式播放（不使用faststart，加快初始响应）
```

### 3. 验证文件请求行为
当 `/file` 请求到达时，查看后端日志：

**流式模式应该看到的日志**：
```
[transcode-server] 📥 文件请求，缓存ID: transcode-xxx 模式: 流式播放
[transcode-server] ⏳ 等待初始数据（至少50KB）... transcode-xxx
[transcode-server] ✅ 初始数据就绪（123.45KB），开始流式返回...
[transcode-server] ✅ 开始流式返回文件: ... 当前大小: 12.34MB
```

**等待完成模式应该看到的日志**：
```
[transcode-server] 📥 文件请求，缓存ID: transcode-xxx 模式: 等待完成
[transcode-server] ⏳ 文件仍在转码中，等待完成... transcode-xxx
[transcode-server] ✅ 转码完成，开始返回文件... transcode-xxx
[transcode-server] ✅ 返回完整文件: ... 大小: 12.34MB
```

### 4. 验证HTTP响应头

**流式模式的响应头应该包含**：
```
Transfer-Encoding: chunked
Content-Type: video/mp4
Cache-Control: no-cache, no-store
（没有 Content-Length）
```

**等待完成模式的响应头应该包含**：
```
Content-Length: 12345678
Content-Range: bytes 0-12345677/12345678
Accept-Ranges: bytes
Content-Type: video/mp4
Cache-Control: public, max-age=86400
```

### 5. 浏览器网络检查

打开浏览器开发者工具 → 网络 → 查看 `/file?id=...` 请求：

**流式模式**：
- Status: 200
- Content-Length: （没有显示，或显示为 0）
- 传输大小会持续增加，最终达到完整文件大小

**等待完成模式**：
- Status: 200
- Content-Length: 完整文件大小（如 12345678）
- 传输大小 = Content-Length

## 常见问题排查

### Q: 切换到流式模式后，仍然等待很久才能播放
**A**: 可能有两个原因：
1. 缓存中的文件是用等待完成模式转码的，需要清除缓存
2. 浏览器缓存了旧的响应，清除浏览器缓存或用无痕模式测试

**解决方案**：
- 打开转码配置面板，清除所有缓存
- 清除浏览器缓存（Ctrl+Shift+Delete）
- 重新播放视频

### Q: 流式播放时出现"504 Gateway Timeout"错误
**A**: 初始数据生成超时（超过120秒）

**可能原因**：
- 视频太大或网络太慢，50KB数据需要超过120秒生成
- ffmpeg崩溃或卡住

**解决方案**：
- 检查后端日志是否有 ffmpeg 错误
- 尝试切回等待完成模式
- 清除缓存并重新尝试

### Q: 流式播放无法跳转/拖动进度条
**A**: 这是流式播放的正常行为。流式模式下浏览器无法知道文件总长度，所以：
- 无法显示精确的进度条
- 无法快速拖动（只能逐段接收）

**如果需要完整的寻址支持**，请使用等待完成模式。

## 技术细节

### ffmpeg 参数变化

**等待完成模式**：
```bash
ffmpeg -i input.mov ... -movflags faststart output.mp4
```
- `faststart`：将 MP4 原子表（moov atom）移到文件开头
- 需要完整的文件写入才能生成有效的 moov atom
- 一旦生成，文件可被浏览器识别和寻址

**流式播放模式**：
```bash
ffmpeg -i input.mov ... output.mp4
```
- 不使用 `faststart`，让 ffmpeg 尽快开始输出
- moov atom 在文件末尾，但浏览器可以逐段接收视频数据
- 对于分段 MP4（DASH/HLS），浏览器知道如何处理

### HTTP Transfer-Encoding

**流式模式使用 `Transfer-Encoding: chunked`**，这意味着：
- 响应没有 `Content-Length` 头
- 数据分块发送，每块前有大小指示
- 浏览器持续接收直到连接关闭
- 这是 HTTP/1.1 的标准流式传输方法

## 日志关键字

搜索以下关键字可快速定位问题：

- `转码模式:` - 当前使用的转码模式
- `等待初始数据` - 流式模式正在等待初始数据
- `初始数据就绪` - 已收集足够的初始数据，开始流式返回
- `文件仍在转码中` - 等待完成模式正在等待转码
- `转码完成` - 等待完成模式的转码已完成
- `流式返回文件` - 正在使用 chunked 编码返回文件
- `返回完整文件` - 正在返回完整的有 Content-Length 的文件

## 测试命令

在开发者工具控制台中测试：

```javascript
// 获取转码端口
const port = await window.electronAPI.getTranscodePort();

// 检查当前配置
const config = await fetch(`http://127.0.0.1:${port}/config`).then(r => r.json());
console.log('当前配置:', config);
// 输出应该包含 waitForComplete: false 或 true

// 切换到流式播放模式
await fetch(`http://127.0.0.1:${port}/set-wait-mode`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ waitForComplete: false })
}).then(r => r.json()).then(console.log);

// 验证配置已改变
const config2 = await fetch(`http://127.0.0.1:${port}/config`).then(r => r.json());
console.log('更新后配置:', config2);
```

## 进一步调试

如果仍有问题，请收集以下信息：

1. **后端日志**（开发者工具 → 主进程控制台）
2. **前端日志**（开发者工具 → 渲染进程控制台）
3. **网络请求详情**（F12 → 网络标签页）
4. **转码配置面板中显示的参数**

然后分享这些信息以便诊断。
