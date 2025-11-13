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
        chunkSizeWarningLimit: 1024,
        // minify: 'terser',
        // terserOptions: {
        //     compress: {
        //         drop_console: true,
        //         drop_debugger: true
        //     },
        //     format: {
        //         comments: false
        //     }
        // },
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
