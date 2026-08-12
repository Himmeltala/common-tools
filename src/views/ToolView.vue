<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\views\ToolView.vue
 * @Description: 工具视图容器，根据路由参数动态加载对应的工具组件
-->
<template>
  <div class="tool-view">
    <div v-if="!currentTool" class="tool-not-found">
      <el-empty description="未找到对应的工具" />
    </div>
    <component v-else :is="currentTool.component" :key="route.fullPath" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { toolRegistry } from '@/composables/useToolRegistry'

const route = useRoute()

// 从路由参数中获取 categoryId 和 toolId
const currentTool = computed(() => {
  const categoryId = route.params.categoryId as string
  const toolId = route.params.toolId as string
  if (!categoryId || !toolId) return null
  return toolRegistry.getTool(categoryId, toolId) || null
})
</script>

<style scoped>
.tool-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.tool-not-found {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
