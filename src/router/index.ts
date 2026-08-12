/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\router\index.ts
 * @Description: 路由配置，首页为仪表盘，工具页使用动态路由
 */
import { createRouter, createMemoryHistory } from 'vue-router'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/tool/:categoryId/:toolId',
      name: 'tool',
      component: () => import('../views/ToolView.vue'),
      meta: { title: '工具' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
