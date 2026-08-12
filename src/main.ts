/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\main.ts
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
import { registerBuiltinTools } from '@/tools'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 注册所有内置工具类别和工具
registerBuiltinTools()

// Vue 运行时错误处理
app.config.errorHandler = (err, _instance, info) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[Vue Error] ${info}: ${msg}`)
}

// 未捕获 JS 异常
window.onerror = (_event, _source, _lineno, _colno, err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[Unhandled Error] ${msg}`)
}

// 未捕获 Promise 拒绝
window.onunhandledrejection = (event) => {
  const reason = event.reason
  const msg = reason instanceof Error ? reason.message : String(reason)
  console.error(`[Unhandled Rejection] ${msg}`)
}

app.mount('#app')
