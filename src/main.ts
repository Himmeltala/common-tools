/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-27 09:00:14
 * @FilePath: /src/main.ts
 * @Description: 应用入口，挂载 Vue 实例、注册插件和全局错误处理
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from '@/App.vue'
import router from '@/router'
import { useLogStore } from '@/stores/log.store'
import { registerBuiltinTools } from '@/tools'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  app.use(ElementPlus, { locale: zhCn })

  // 注册所有内置工具类别和工具
  registerBuiltinTools()

  // 保存原生 console.warn 引用，避免后续 App.vue 覆盖层 JSON.stringify 循环引用对象
  const nativeWarn = console.warn
  app.config.warnHandler = (msg, _instance, trace) => {
    nativeWarn(`[Vue warn] ${msg}${trace ? `\n${trace}` : ''}`)
  }

  // Vue 运行时错误捕获
  app.config.errorHandler = (err, _instance, info) => {
    const logStore = useLogStore(pinia)
    const msg = err instanceof Error ? err.message : String(err)
    logStore.addLog('error', `[Vue] ${msg}${info ? ` (${info})` : ''}`)
  }

  app.mount('#app')
}

bootstrap()
