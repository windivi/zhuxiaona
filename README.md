<div align="center"> 

# 朱小娜专用版 🎬

一个基于 **Electron** + **Vue3** + **FFmpeg** 的多格式视频播放应用  
支持任意视频格式自动转码播放,针对中端设备优化

</div>

## ✨ 核心特性

- 🎥 **万能播放器**: 支持所有 FFmpeg 支持的视频格式(500+ 编解码器)
- ⚡ **智能转码**: 自动检测视频编码,按需实时转码
- 🔧 **硬件加速**: 自动启用 DXVA2 硬件解码(Windows)
- 🎯 **性能优化**: 针对 i5-9400F + GT710 深度优化
- 📱 **现代架构**: Electron + Vue3 + Vite + TypeScript

## 📋 系统要求

### 运行环境
- **操作系统**: Windows 10/11
- **CPU**: Intel i5 或更高(推荐 6核+)
- **内存**: 8GB+(推荐 16GB)
- **显卡**: 支持 H.264 硬解的独立显卡(GT710 或更高)

### 开发依赖
- **Node.js**: 18.x 或更高
- **FFmpeg**: 5.1 或更高 (**必需**)
- **pnpm**: 8.x 或更高

---

## 🚀 快速开始

### 1. 安装 FFmpeg

#### Windows (使用 Chocolatey)
```bash
choco install ffmpeg
```

#### 或手动安装
1. 下载: https://www.gyan.dev/ffmpeg/builds/
2. 解压到 `C:\ffmpeg`
3. 添加到 PATH: `C:\ffmpeg\bin`
4. 验证: `ffmpeg -version`

### 2. 安装依赖
```bash
pnpm install
```

### 3. 开发模式
```bash
pnpm dev
```

### 4. 构建应用
```bash
pnpm build:win  # Windows版本
pnpm build:mac  # macOS版本
pnpm build:linux # Linux版本
```

---

## 📖 使用文档

- **完整方案文档**: [VIDEO_SOLUTION.md](./VIDEO_SOLUTION.md)
- **快速部署指南**: [QUICK_START.md](./QUICK_START.md)

---

## 🎬 视频播放功能

### 组件使用示例
```vue
<template>
  <!-- 自动检测模式 (推荐) -->
  <EzPlayer :src="videoUrl" />
  
  <!-- 强制转码模式 -->
  <EzPlayer :src="videoUrl" :transcode="true" />
</template>

<script setup lang="ts">
import EzPlayer from '@/components/video/index.vue'
const videoUrl = 'https://example.com/video.mov'
</script>
```

### API 使用
```typescript
// 检测是否需要转码
const probe = await window.electronAPI.shouldTranscode(videoUrl)
console.log('编码格式:', probe.codec)        // hevc, h264, vp9, etc.
console.log('需要转码:', probe.shouldTranscode)

// 获取转码地址
const result = await window.electronAPI.getTranscodeUrl(videoUrl)
console.log('播放地址:', result.url)
```

### 支持的格式
- ✅ **直接播放**: H.264/AAC (MP4, FLV)
- 🔄 **自动转码**: HEVC, VP9, AV1, ProRes, MOV, MKV, AVI, WebM...
- 📦 **理论支持**: 所有 FFmpeg 支持的格式

---

## 🔧 配置说明

### 转码参数优化
位置: `src/main/main.ts` Line 90-130

```typescript
// 关键参数
'-preset', 'ultrafast',  // 编码速度: ultrafast | veryfast | fast
'-b:v', '1200k',        // 码率: 800k | 1200k | 2000k  
'-r', '25',             // 帧率: 20 | 25 | 30
```

### 播放器配置
位置: `src/renderer/components/video/index.vue`

```typescript
{
  WASM: true,           // WebAssembly 加速
  WASMSIMD: true,       // SIMD 优化
  gpuDecoder: false,    // 针对GT710禁用GPU解码
  bufferTime: 0.3,      // 缓冲时间(秒)
}
```

---

## About

This template utilizes [ViteJS](https://vitejs.dev) for building and serving your (Vue powered) front-end process, it provides Hot Reloads (HMR) to make development fast and easy ⚡ 

Building the Electron (main) process is done with [Electron Builder](https://www.electron.build/), which makes your application easily distributable and supports cross-platform compilation 😎

## Getting started

Clone this repository: `git clone https://github.com/windivi/zhuxiaona.git`


### Install dependencies ⏬

```bash
pnpm install
```

### Start developing ⚒️

```bash
pnpm run dev
```

## Additional Commands

```bash
pnpm run dev # starts application with hot reload
pnpm run build # builds application, distributable files can be found in "dist" folder

# OR

pnpm run build:win # uses windows as build target
pnpm run build:mac # uses mac as build target
pnpm run build:linux # uses linux as build target
```

Optional configuration options can be found in the [Electron Builder CLI docs](https://www.electron.build/cli.html).
## Project Structure

```bash
- scripts/              # 构建脚本
- src/
  - main/              # Electron 主进程
    - main.ts          # 入口 + FFmpeg转码服务
    - preload.ts       # IPC API 暴露
    - browserAutomation.ts  # 浏览器自动化
  - renderer/          # Vue3 渲染进程  
    - components/
      - video/         # 视频播放器组件
      - simple-video-viewer.vue  # 视频查看器
    - services/        # 业务逻辑
```

---

## 🎯 性能基准

| 视频类型 | 分辨率 | CPU占用 | 内存占用 | 转码 |
|---------|--------|---------|---------|------|
| H.264 MP4 | 720p | 15% | 300MB | ❌ |
| H.264 MP4 | 1080p | 25% | 500MB | ❌ |
| HEVC MOV | 1080p | 65% | 800MB | ✅ |
| HEVC 4K | 2160p | 90% | 1.5GB | ✅ |

**测试环境**: i5-9400F, 16GB RAM, GT 710, Windows 10

---

## 🐛 故障排查

### 视频无法播放
```bash
# 1. 检查 FFmpeg
ffmpeg -version
ffprobe -version

# 2. 查看控制台(F12)
[video] 和 [transcode] 日志

# 3. 测试转码
ffmpeg -i input.mov -c:v libx264 -f null -
```

### CPU 占用过高
```typescript
// 降低转码质量 (main.ts)
-b:v 1200k -> -b:v 800k
-r 25 -> -r 20
scale=...720... -> scale=...540...
```

详细问题解决: 查看 [QUICK_START.md](./QUICK_START.md)

---

## 📄 License

MIT License - 详见 [LICENSE](./LICENSE)

---

## 🙏 致谢

- [Electron](https://www.electronjs.org/)
- [Vue 3](https://vuejs.org/)
- [FFmpeg](https://ffmpeg.org/)
- [EasyPlayer](https://github.com/tsingsee/EasyPlayer.js)
- [Vite](https://vitejs.dev/)

---

## Using static files

If you have any files that you want to copy over to the app directory after installation, you will need to add those files in your `src/main/static` directory.

Files in said directory are only accessible to the `main` process, similar to `src/renderer/assets` only being accessible to the `renderer` process. Besides that, the concept is the same as to what you're used to in your other front-end projects.

#### Referencing static files from your main process

```ts
/* Assumes src/main/static/myFile.txt exists */

import {app} from 'electron';
import {join} from 'path';
import {readFileSync} from 'fs';

const path = join(app.getAppPath(), 'static', 'myFile.txt');
const buffer = readFileSync(path);
```
