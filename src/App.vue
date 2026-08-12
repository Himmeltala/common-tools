<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\App.vue
 * @Description: 根组件，管理主题、侧边栏路由和 IPC 事件
-->
<template>
  <div class="app-root" :class="themeClass">
    <div class="sidebar">
      <el-menu
        :default-active="currentRoute"
        class="sidebar-menu"
        :collapse-transition="false"
        router
        :default-openeds="defaultOpeneds"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <template v-for="category in categories" :key="category.id">
          <el-sub-menu :index="category.id">
            <template #title>
              <el-icon><component :is="category.icon" /></el-icon>
              <span>{{ category.label }}</span>
            </template>
            <el-menu-item v-for="tool in category.tools" :key="tool.id" :index="`/tool/${category.id}/${tool.id}`">
              <el-icon><component :is="tool.icon" /></el-icon>
              <span>{{ tool.label }}</span>
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>
    </div>

    <div class="content-col">
      <div class="main-area">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { HomeFilled } from '@element-plus/icons-vue'
import { toolRegistry } from '@/composables/useToolRegistry'
import { useModal } from '@/composables/useModal'
import SettingsModal from '@/modals/SettingsModal.vue'

const theme = ref('dark')
const themeClass = computed(() => `theme-${theme.value}`)
const route = useRoute()
const currentRoute = computed(() => route.path)

// 工具类别列表，从注册中心获取
const categories = computed(() => toolRegistry.getAll())

// 设置弹窗
const settingsModal = useModal({ component: SettingsModal })

// 打开设置弹窗
function openSettings() {
  settingsModal.open()
}

// 默认展开的菜单项，所有类别均展开
const defaultOpeneds = computed(() => categories.value.map((c) => c.id))

/**
 * 应用主题到 document
 * @param t 主题标识，dark 或 light
 */
function applyTheme(t: string) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.setAttribute('data-theme', 'light')
  }
}

// 闲置检测：5 分钟无操作标记闲置
let idleTimer: number | undefined
const IDLE_TIMEOUT = 5 * 60 * 1000

function resetIdleTimer() {
  window.__appIdle = false
  clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    window.__appIdle = true
  }, IDLE_TIMEOUT)
}

function onUserActivity() {
  if (window.__appIdle) {
    window.__appIdle = false
    window.dispatchEvent(new CustomEvent('app-resume'))
  }
  resetIdleTimer()
}

onMounted(async () => {
  const savedTheme = await window.electronAPI.invoke('settings:get', 'theme')
  theme.value = savedTheme || 'dark'
  applyTheme(theme.value)

  const appCleanups: (() => void)[] = []
  appCleanups.push(
    window.electronAPI.on('event:themeChanged', (newTheme: string) => {
      theme.value = newTheme
      applyTheme(newTheme)
    }),
  )
  // 菜单事件
  appCleanups.push(
    window.electronAPI.on('menu:event', ({ action }: { action: string }) => {
      if (action === 'settings') openSettings()
    }),
  )

  document.addEventListener('mousemove', onUserActivity, { passive: true })
  document.addEventListener('mousedown', onUserActivity, { passive: true })
  document.addEventListener('keydown', onUserActivity, { passive: true })
  document.addEventListener('scroll', onUserActivity, { passive: true })
  resetIdleTimer()

  window.__homeCleanups = window.__homeCleanups || []
  window.__homeCleanups.push(...appCleanups)
})

onUnmounted(() => {
  clearTimeout(idleTimer)
  document.removeEventListener('mousemove', onUserActivity)
  document.removeEventListener('mousedown', onUserActivity)
  document.removeEventListener('keydown', onUserActivity)
  document.removeEventListener('scroll', onUserActivity)
  const cleanups = window.__homeCleanups
  if (cleanups) cleanups.forEach((fn) => fn())
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
:root {
  --app-sidebar-width: 220px;
}
html,
body,
#app {
  height: 100%;
  overflow: hidden;
  font-family: var(--el-font-family, 'Microsoft YaHei', Arial, sans-serif);
}
body {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
</style>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  background: var(--el-bg-color);
}
.sidebar {
  width: var(--app-sidebar-width);
  min-width: var(--app-sidebar-width);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--el-bg-color-overlay);
  border-right: 1px solid var(--el-border-color);
}
.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}
.content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
}
.main-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}
</style>
