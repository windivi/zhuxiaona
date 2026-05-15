import { createApp } from 'vue';
import './style.css';
import 'ant-design-vue/dist/reset.css';
import screenShort from "vue-web-screen-shot";
import App from './App.vue';

// 启动应用
async function bootstrap() {
    // 创建并挂载应用
    const app = createApp(App);
    app.use(screenShort, { enableWebRtc: false, level: 99999 });
    app.mount('#app');
}

bootstrap().catch(error => {
    console.error('[App] 应用启动失败:', error);
});
