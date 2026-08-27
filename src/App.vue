<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-27
 * @FilePath: \src\App.vue
 * @Description: 根组件，管理主题、侧边栏路由、IPC 事件和全局日志面板
-->
<template>
  <div class="app-root" :class="themeClass">
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <el-menu
        :default-active="currentRoute"
        class="sidebar-menu"
        :collapse-transition="false"
        router
        :default-openeds="defaultOpeneds"
        size="small"
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
      <div class="sidebar-resizer" @mousedown="onResizeMouseDown" @dblclick="onResizeDblClick"></div>
    </div>

    <div class="content-col">
      <div class="main-area">
        <router-view />
      </div>

      <GlobalLogPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { HomeFilled } from '@element-plus/icons-vue'
import { toolRegistry } from '@/composables/useToolRegistry'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { useResizePanel } from '@/composables/useResizePanel'
import GlobalLogPanel from '@/components/GlobalLogPanel.vue'
import SettingsModal from '@/modals/SettingsModal.vue'

const theme = ref('dark')
const themeClass = computed(() => `theme-${theme.value}`)
const route = useRoute()
const currentRoute = computed(() => route.path)
const logStore = useLogStore()

// 侧边栏拖拽调整宽度
const { panelWidth: sidebarWidth, onResizeMouseDown, onResizeDblClick } = useResizePanel({
  defaultWidth: 220,
  minWidth: 180,
  maxWidth: 400,
  loadWidth: () => window.electronAPI.invoke('store:get', 'sidebarWidth'),
  saveWidth: (width) => window.electronAPI.invoke('store:set', 'sidebarWidth', width),
})

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
  logStore.loadSettings()

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

  // 全局异常自动送入日志面板
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    origConsoleError.apply(console, args)
    logStore.addLog(
      'error',
      args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
    )
  }

  const origConsoleWarn = console.warn
  console.warn = (...args: unknown[]) => {
    origConsoleWarn.apply(console, args)
    logStore.addLog(
      'warning',
      args
        .map((a) => {
          if (typeof a === 'string') return a
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' '),
    )
  }

  window.onerror = (_msg, _source, _lineno, _colno, err) => {
    const msg = err?.message || String(_msg)
    logStore.addLog('error', `[Runtime] ${msg}`)
  }

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    logStore.addLog('error', `[Promise] ${msg}`)
  })

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
  --app-space-1: 4px;
  --app-space-2: 8px;
  --app-space-3: 12px;
  --app-space-4: 16px;
  --app-space-5: 20px;
  --app-space-6: 24px;
  --app-padding-toolbar: var(--app-space-1) var(--app-space-2);
  --app-padding-compact: 2px var(--app-space-2);
  --app-gap-toolbar: var(--app-space-1);
  --app-gap-section: var(--app-space-3);
  --app-gap-group: var(--app-space-5);
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
  min-width: 180px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--el-bg-color-overlay);
  border-right: 1px solid var(--el-border-color);
  position: relative;
}
.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}
.sidebar-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.2s;
}
.sidebar-resizer:hover {
  background: var(--el-color-primary);
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
