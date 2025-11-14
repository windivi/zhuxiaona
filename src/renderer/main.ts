import { createApp } from 'vue'
import './style.css';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue'

// 启动应用
async function bootstrap() {
    // 创建并挂载应用
    const app = createApp(App);
    app.mount('#app');
}

bootstrap().catch(error => {
    console.error('[App] 应用启动失败:', error)
})
