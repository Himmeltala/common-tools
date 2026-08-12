<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\views\DashboardView.vue
 * @Description: 首页仪表盘，展示所有工具类别的入口
-->
<template>
  <div class="dashboard">
    <h2 class="dashboard-title">工具箱</h2>
    <p class="dashboard-subtitle">选择一个工具开始使用</p>
    <div class="category-grid">
      <el-card
        v-for="category in categories"
        :key="category.id"
        class="category-card"
        shadow="hover"
        @click="openFirstTool(category)"
      >
        <div class="category-content">
          <el-icon :size="32"><component :is="category.icon" /></el-icon>
          <span class="category-label">{{ category.label }}</span>
          <span class="category-count">{{ category.tools.length }} 个工具</span>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { toolRegistry } from '@/composables/useToolRegistry'
import type { ToolCategory } from '@/types/tool'

const router = useRouter()
const categories = computed(() => toolRegistry.getAll())

/**
 * 点击类别卡片，跳转到该类别的第一个工具
 * @param category 工具类别
 */
function openFirstTool(category: ToolCategory) {
  const firstTool = category.tools[0]
  if (firstTool) {
    router.push(`/tool/${category.id}/${firstTool.id}`)
  }
}
</script>

<style scoped>
.dashboard {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80px;
  overflow: auto;
}
.dashboard-title {
  font-size: 24px;
  margin-bottom: 8px;
}
.dashboard-subtitle {
  color: var(--el-text-color-secondary);
  margin-bottom: 32px;
}
.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  max-width: 800px;
}
.category-card {
  width: 200px;
  cursor: pointer;
}
.category-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.category-label {
  font-size: 16px;
  font-weight: 500;
}
.category-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
