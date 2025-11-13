# 转码功能改进总结

## 问题
转码完成后无法正确播放视频文件。

## 原因分析
1. **文件路径问题**：之前尝试通过 HTTP 传递完整的 Windows 路径（如 `C:\Users\...`），这在浏览器中不适用
2. **端点设计不佳**：文件路径包含特殊字符（反斜杠、冒号等），URL 编码后可能导致路径验证失败

## 解决方案
将转码服务的返回值从 **文件路径** 改为 **缓存ID**，使用抽象化的资源标识符而不是具体路径。

### 关键改动

#### 1. 后端转码服务 (`src/main/services/transcode-server.ts`)

**TranscodeCache 类增强**：
```typescript
// 新增方法：根据源URL生成缓存ID（MD5哈希）
getCacheId(sourceUrl: string): string

// 新增方法：根据缓存ID获取文件完整路径
getFilePathById(cacheId: string): string | null
```

**端点变化**：
- `/transcode?url=<source_url>` 
  - **旧返回**：`{success: true, filePath: "C:\\Users\\..."}`
  - **新返回**：`{success: true, cacheId: "transcode-abc123def456.mp4"}`

- `/file?id=<cache_id>`（新参数格式）
  - **旧参数**：`path=C:\Users\...` （完整路径）
  - **新参数**：`id=transcode-abc123def456.mp4` （缓存ID）
  - 内部通过 `transcodeCache.getFilePathById()` 获取实际路径
  - 增强的安全检查确保文件在缓存目录内

#### 2. IPC 处理器 (`src/main/ipc/ipc-handlers.ts`)

```typescript
// 新增 IPC 处理器
ipcMain.handle('get-transcode-port', () => { ... })

// 更新返回值格式
ipcMain.handle('get-transcode-url', async (event, inputUrl) => {
  // ...
  return { success: true, cacheId: result.cacheId }  // 改为缓存ID
})
```

#### 3. 前端视频组件 (`src/renderer/components/video/index.vue`)

**getTranscodeUrl 函数**：
```typescript
// 新逻辑：根据返回的 cacheId 构造文件加载URL
const fileUrl = `http://127.0.0.1:${port}/file?id=${encodeURIComponent(result.cacheId)}`
```

**播放流程增强**：
- 添加 `canplay` 事件监听，确保元数据加载后再播放
- 添加 5 秒超时机制，防止加载卡死
- 完整的错误日志用于调试

#### 4. Preload 脚本 (`src/main/preload.ts`)

新增 `getTranscodePort` API 暴露给渲染进程。

## 工作流程

### 转码流程
1. **前端**：检测到需要转码的视频（H.265/HEVC）
2. **IPC**：调用 `electronAPI.getTranscodeUrl(inputUrl)`
3. **主进程**：
   - 获取转码服务端口
   - 调用 `/transcode?url=...` 端点
4. **转码服务**：
   - 检查缓存（命中直接返回）
   - 下载视频到临时文件
   - 转码为 H.264 MP4 格式
   - **删除临时下载文件**（垃圾清理）
   - 保存为缓存文件
   - 执行滑动窗口策略（最多5个文件）
   - 返回 `{success: true, cacheId: "..."}`
5. **主进程**：将缓存ID回传给前端
6. **前端**：构造文件端点 URL：`http://127.0.0.1:PORT/file?id=CACHE_ID`
7. **前端**：设置为 video 标签的 src，加载并播放

### 文件管理
- **缓存目录**：`{OS_TEMP}/transcode-cache/`
- **文件命名**：`transcode-{MD5_HASH_OF_SOURCE_URL}.mp4`
- **缓存策略**：最多保留5个文件，超限时删除最旧的（LRU）
- **临时文件**：下载后立即删除，只保留最终转码输出

## 好处

1. ✅ **更安全**：不暴露本地文件系统路径给前端
2. ✅ **更稳定**：避免 Windows 路径特殊字符导致的问题
3. ✅ **更简洁**：缓存ID 是简单的相对路径，无路径分隔符
4. ✅ **更高效**：后端可以灵活管理缓存位置，前端无需关心
5. ✅ **更易维护**：清晰的接口契约

## 测试建议

1. 播放 H.265 视频，确认能完整转码并播放
2. 重复播放同一个视频，确认缓存命中（快速返回）
3. 连续播放多个视频，验证 5 文件限制和 LRU 清理
4. 检查临时文件是否被清理
