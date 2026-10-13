<!--
 * @Author: zhengrenfu
 * @Date: 2026-10-13
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-10-13
 * @FilePath: /src/components/PlainEditor.vue
 * @Description: 原生 textarea 编辑器，供各工具的文本输入区使用
-->
<template>
  <textarea v-model="model" class="editor-textarea" :placeholder="placeholder" spellcheck="false" autocomplete="off" />
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' })

defineProps({
  placeholder: {
    type: String,
    default: '',
  },
})
</script>
