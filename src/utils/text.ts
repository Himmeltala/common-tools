/*
 * @Author: zhengrenfu
 * @Date: 2026-08-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-14
 * @FilePath: \src\utils\text.ts
 * @Description: 文本处理公共函数，用于限制界面渲染的文本量、避免大量文本导致卡顿
 */

/** 界面最多展示的文本行数，超出部分不渲染以保证性能 */
export const MAX_DISPLAY_LINES = 200

export interface TruncateLinesResult {
  /** 截断后的文本，未截断时为原文本 */
  text: string
  /** 是否发生了截断 */
  truncated: boolean
  /** 原始文本总行数 */
  totalLines: number
}

/**
 * 将文本截断到前 maxLines 行
 * 用于限制界面展示内容：完整文本仍保留在内存中供复制/保存使用，仅渲染前若干行
 * @param text 原始文本
 * @param maxLines 最大显示行数
 * @returns 截断结果
 */
export function truncateLines(text: string, maxLines: number = MAX_DISPLAY_LINES): TruncateLinesResult {
  if (!text) return { text: '', truncated: false, totalLines: 0 }

  let newlines = 0
  let cutoff = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      newlines++
      if (cutoff === -1 && newlines === maxLines) {
        cutoff = i
      }
    }
  }

  const totalLines = newlines + 1
  const truncated = totalLines > maxLines
  return {
    text: truncated ? text.slice(0, cutoff) : text,
    truncated,
    totalLines,
  }
}
