/*
 * @Author: zhengrenfu
 * @Date: 2026-08-27
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-27
 * @FilePath: \src\composables\useResizePanel.ts
 * @Description: 可拖拽调整宽度的面板逻辑，支持持久化保存与恢复
 */
import { ref, onMounted } from 'vue'

/** 拖拽调整宽度配置 */
export interface ResizeOptions {
  /** 默认宽度 */
  defaultWidth: number
  /** 最小宽度 */
  minWidth: number
  /** 最大宽度 */
  maxWidth: number
  /** 从持久化存储读取宽度 */
  loadWidth: () => Promise<number | null>
  /** 将宽度持久化保存 */
  saveWidth: (width: number) => Promise<void>
}

/**
 * 可拖拽调整宽度的面板逻辑
 * @param options 配置项
 * @returns 面板宽度及相关事件处理函数
 */
export function useResizePanel(options: ResizeOptions) {
  const { defaultWidth, minWidth, maxWidth, loadWidth, saveWidth } = options
  const panelWidth = ref(defaultWidth)
  let isResizing = false
  let startX = 0
  let startWidth = 0

  /**
   * 拖拽开始
   * @param e 鼠标事件
   */
  function onResizeMouseDown(e: MouseEvent) {
    isResizing = true
    startX = e.clientX
    startWidth = panelWidth.value
    document.addEventListener('mousemove', onResizeMouseMove)
    document.addEventListener('mouseup', onResizeMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  /**
   * 拖拽中
   * @param e 鼠标事件
   */
  function onResizeMouseMove(e: MouseEvent) {
    if (!isResizing) return
    const diff = e.clientX - startX
    panelWidth.value = Math.min(maxWidth, Math.max(minWidth, startWidth + diff))
  }

  /**
   * 拖拽结束，保存宽度
   */
  async function onResizeMouseUp() {
    isResizing = false
    document.removeEventListener('mousemove', onResizeMouseMove)
    document.removeEventListener('mouseup', onResizeMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    await saveWidth(panelWidth.value)
  }

  /**
   * 双击恢复默认宽度
   */
  async function onResizeDblClick() {
    panelWidth.value = defaultWidth
    await saveWidth(panelWidth.value)
  }

  /** 从持久化存储恢复宽度 */
  onMounted(async () => {
    const savedWidth = await loadWidth()
    if (savedWidth && savedWidth >= minWidth && savedWidth <= maxWidth) {
      panelWidth.value = savedWidth
    }
  })

  return {
    panelWidth,
    onResizeMouseDown,
    onResizeDblClick,
  }
}
