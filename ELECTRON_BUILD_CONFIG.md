# Electron 构建 - 阿里云镜像配置

## 已配置的内容

### 1. `.npmrc` 配置
添加了以下环境变量：
```properties
ELECTRON_MIRROR=https://registry.npmmirror.com/-/raw/electron/
ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/raw/electron-builder-binaries/
```

### 2. `electron-builder.json` 配置
添加了：
```json
{
  "electronDownload": {
    "mirror": "https://registry.npmmirror.com/-/raw/electron/"
  }
}
```

### 3. `scripts/build.js` 配置
在构建脚本中自动设置环境变量，确保 electron-builder 使用阿里云镜像。

## 构建命令

### Windows 构建
```bash
yarn build:win
# 或
npm run build:win
```

### macOS 构建
```bash
yarn build:mac
```

### Linux 构建
```bash
yarn build:linux
```

## 工作原理

1. **npm 模块下载**：`.npmrc` 中的配置确保 npm/pnpm 从阿里云镜像下载 electron 和相关包
2. **Electron 二进制下载**：`ELECTRON_MIRROR` 环境变量指定 electron 运行时的下载源
3. **构建工具**：`ELECTRON_BUILDER_BINARIES_MIRROR` 配置构建工具使用的镜像

## 手动设置环境变量（如果需要）

如果 `.npmrc` 未被正确读取，可以手动设置：

### Windows (PowerShell)
```powershell
$env:ELECTRON_MIRROR = "https://registry.npmmirror.com/-/raw/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://registry.npmmirror.com/-/raw/electron-builder-binaries/"
yarn build:win
```

### Windows (cmd)
```cmd
set ELECTRON_MIRROR=https://registry.npmmirror.com/-/raw/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/raw/electron-builder-binaries/
yarn build:win
```

### macOS/Linux (bash)
```bash
export ELECTRON_MIRROR=https://registry.npmmirror.com/-/raw/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://registry.npmmirror.com/-/raw/electron-builder-binaries/
yarn build:win
```

## 清除缓存后重新构建

如果遇到缓存问题：

```bash
# 清除 npm/pnpm 缓存
pnpm store prune
# 或
npm cache clean --force

# 清除 electron 缓存
rm -rf ~/.electron
# Windows: rmdir %APPDATA%\..\Local\electron /s /q

# 重新安装依赖
pnpm install --force
# 或
npm install --force

# 构建
yarn build:win
```

## 镜像源对比

| 源 | 速度 | 稳定性 | 备注 |
|---|---|---|---|
| 官方 (npmjs.org) | 慢 | 稳定 | 国际网络慢 |
| 阿里云 (npmmirror.com) | ⭐⭐⭐⭐⭐ | 稳定 | 推荐，国内最快 |
| 淘宝 (registry.npm.taobao.org) | ⭐⭐⭐⭐ | 稳定 | 已归入阿里云 |

## 常见问题

### Q: 构建时还是下载很慢？
A: 检查网络连接，或使用代理。确认环境变量设置正确。

### Q: electron 缓存位置？
- macOS: `~/.electron`
- Windows: `%APPDATA%\..\Local\electron` 或 `%HOME%\.electron`
- Linux: `~/.electron`

### Q: 离线构建？
A: 确保 electron 和相关依赖已下载，然后离线构建。

## 相关文档

- [electron-builder 官方文档](https://www.electron.build/)
- [阿里云 npm 镜像](https://developer.aliyun.com/mirror/npm)
