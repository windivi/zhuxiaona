const Path = require('path');
const vuePlugin = require('@vitejs/plugin-vue')
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';
const { defineConfig } = require('vite');

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
    root: Path.join(__dirname, 'src', 'renderer'),
    publicDir: 'public',
    server: {
        port: 8080,
    },
    open: false,
    build: {
        outDir: Path.join(__dirname, 'build', 'renderer'),
        emptyOutDir: true,
        // 为了解决「chunk 过大」的警告并优化输出，添加 manualChunks 拆分第三方库。
        // 这里按常见大依赖分包：vue、ant-design-vue、lodash-es、@vueuse 以及其余 vendor。
        // 同时将 chunkSizeWarningLimit 提高到 1024 KB（可按需调整或去掉以恢复默认警告）。
        chunkSizeWarningLimit: 1024,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id) return;
                    if (id.includes('node_modules')) {
                        if (id.includes('node_modules/vue/')) return 'vendor_vue';
                        if (id.includes('node_modules/ant-design-vue') || id.includes('node_modules/@ant-design')) return 'vendor_antdv';
                        if (id.includes('node_modules/lodash-es')) return 'vendor_lodash';
                        if (id.includes('node_modules/@vueuse')) return 'vendor_vueuse';
                        // puppeteer-core 应该只在主进程使用（src/main），通常不会被 renderer 打包。如果误打包，可单独拆分
                        if (id.includes('node_modules/puppeteer-core')) return 'vendor_puppeteer';
                        // 默认把 node_modules 下的其它依赖都打到 vendor 中（能被浏览器共享缓存）
                        return 'vendor';
                    }
                }
            }
        },
    },
    plugins: [
        vuePlugin(),
        Components({
            resolvers: [
                AntDesignVueResolver({
                    importStyle: false, // css in js
                }),
            ],
        }),],
});

module.exports = config;
