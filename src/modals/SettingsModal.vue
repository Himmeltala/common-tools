<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\modals\SettingsModal.vue
 * @Description: 设置弹窗，左侧分类导航、右侧表单内容
-->
<template>
  <el-dialog v-model="localVisible" title="设置" width="50vw" top="2vh" :close-on-click-modal="false">
    <div class="settings-layout">
      <el-menu :default-active="activeCategory" class="settings-menu" @select="activeCategory = $event as string">
        <el-menu-item v-for="cat in categories" :key="cat.key" :index="cat.key">
          {{ cat.label }}
        </el-menu-item>
      </el-menu>
      <div class="settings-content">
        <el-scrollbar style="max-height: 70vh">
          <template v-for="cat in categories" :key="cat.key">
            <div v-if="cat.key === activeCategory">
              <div v-for="group in cat.groups" :key="group.label" class="settings-group">
                <h3>{{ group.label }}</h3>
                <div
                  v-for="setting in group.settings"
                  :key="setting.key"
                  class="setting-row"
                  v-show="isVisible(setting)"
                >
                  <label>{{ setting.label }}</label>
                  <div class="setting-control">
                    <!-- 复选框 -->
                    <el-switch
                      v-if="setting.type === 'checkbox'"
                      v-model="settingValues[setting.key]"
                      @change="onChange(setting.key, $event)"
                    />
                    <!-- 下拉选择 -->
                    <el-select
                      v-else-if="setting.type === 'combo'"
                      v-model="settingValues[setting.key]"
                      size="small"
                      @change="onChange(setting.key, $event)"
                    >
                      <el-option
                        v-for="opt in setting.options"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                    <!-- 数字输入 -->
                    <div v-else-if="setting.type === 'spinbox'" class="spinbox-wrap">
                      <el-input-number
                        v-model="settingValues[setting.key]"
                        :min="setting.min"
                        :max="setting.max"
                        :step="setting.step"
                        size="small"
                        @change="onChange(setting.key, $event)"
                      />
                      <span v-if="setting.suffix" class="spinbox-suffix">{{ setting.suffix }}</span>
                    </div>
                    <!-- 文本输入 -->
                    <el-input
                      v-else
                      v-model="settingValues[setting.key]"
                      :placeholder="setting.placeholder"
                      size="small"
                      @blur="onChange(setting.key, settingValues[setting.key])"
                    />
                    <div v-if="setting.description" class="setting-desc">{{ setting.description }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </el-scrollbar>
      </div>
    </div>
    <template #footer>
      <el-button size="small" type="danger" @click="handleReset">重置默认值</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const localVisible = ref(false)
const activeCategory = ref('')
const categories = ref<any[]>([])
const settingValues = ref<Record<string, any>>({})

watch(
  () => props.visible,
  async (v) => {
    localVisible.value = v
    if (v) await loadSchema()
  },
)

watch(localVisible, (v) => {
  emit('update:visible', v)
})

// 加载设置 schema 和当前值
async function loadSchema() {
  try {
    const schema = await window.electronAPI.invoke('settings:getSchema')
    if (schema && schema.length > 0) {
      categories.value = schema
      activeCategory.value = schema[0].key
    }
    const allSettings: Array<{ key: string; default: any }> = []
    for (const cat of categories.value) {
      for (const group of cat.groups) {
        for (const setting of group.settings) {
          allSettings.push({ key: setting.key, default: setting.default })
        }
      }
    }
    const values = await Promise.all(allSettings.map((s) => window.electronAPI.invoke('settings:get', s.key)))
    for (let i = 0; i < allSettings.length; i++) {
      const val = values[i]
      settingValues.value[allSettings[i].key] = val !== undefined && val !== null ? val : allSettings[i].default
    }
  } catch {
    // 加载失败静默处理
  }
}

/**
 * 检查设置项是否可见（基于 dependsOn 条件）
 * @param setting 设置字段定义
 * @returns 是否可见
 */
function isVisible(setting: any): boolean {
  if (!setting.depends_on) return true
  const parentVal = settingValues.value[setting.depends_on]
  const expected = setting.depends_value !== undefined ? setting.depends_value : true
  return parentVal === expected
}

// 写入设置值并持久化
async function onChange(key: string, value: any) {
  await window.electronAPI.invoke('settings:set', key, value)
}

// 重置所有设置为默认值
async function handleReset() {
  try {
    await ElMessageBox.confirm('确定将所有设置重置为默认值？', '确认重置', {
      type: 'warning',
      confirmButtonText: '重置',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  const resetEntries: Array<{ key: string; def: any }> = []
  for (const cat of categories.value) {
    for (const group of cat.groups) {
      for (const setting of group.settings) {
        const def = setting.default
        settingValues.value[setting.key] = def
        resetEntries.push({ key: setting.key, def })
      }
    }
  }
  await Promise.all(resetEntries.map((e) => window.electronAPI.invoke('settings:set', e.key, e.def)))
}
</script>

<style scoped>
.settings-layout {
  display: flex;
  gap: 16px;
  min-height: 360px;
}
.settings-menu {
  width: 120px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color);
}
.settings-content {
  flex: 1;
  min-width: 0;
}
.settings-group {
  margin-bottom: 16px;
}
.settings-group h3 {
  font-size: var(--el-font-size-base);
  color: var(--el-color-primary);
  margin-bottom: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--el-border-color);
}
.setting-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.setting-row label {
  width: 100px;
  text-align: right;
  font-size: var(--el-font-size-small);
  padding-top: 4px;
  flex-shrink: 0;
}
.setting-control {
  flex: 1;
}
.setting-desc {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.spinbox-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.spinbox-suffix {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
