/*
 * @Author: zhengrenfu
 * @Date: 2026-10-13
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-10-13
 * @FilePath: /src/utils/mermaid.ts
 * @Description: Mermaid 主题配置与带缓存的渲染入口，供 Mermaid 预览与 Markdown 预览共用
 */

import mermaid from 'mermaid'
import type { MermaidConfig } from 'mermaid'

export type MermaidThemeName =
  'default' | 'basic' | 'dark' | 'forest' | 'neutral' | 'neo' | 'neo-dark' | 'redux' | 'redux-dark'

export interface MermaidTheme {
  id: MermaidThemeName
  label: string
}

// 预设主题
export const MERMAID_THEMES: MermaidTheme[] = [
  { id: 'default', label: '默认' },
  { id: 'basic', label: '基础' },
  { id: 'dark', label: '暗色' },
  { id: 'forest', label: '森林' },
  { id: 'neutral', label: '中性' },
  { id: 'neo', label: 'Neo' },
  { id: 'neo-dark', label: 'Neo 暗色' },
  { id: 'redux', label: 'Redux' },
  { id: 'redux-dark', label: 'Redux 暗色' },
]

// 内置主题直接映射，自定义主题基于 base 主题定制 themeVariables
interface MermaidThemeConfig {
  theme: NonNullable<MermaidConfig['theme']>
  themeVariables?: Record<string, string>
}

const THEME_CONFIGS: Record<MermaidThemeName, MermaidThemeConfig> = {
  default: { theme: 'default' },
  dark: { theme: 'dark' },
  forest: { theme: 'forest' },
  neutral: { theme: 'neutral' },
  neo: { theme: 'neo' },
  'neo-dark': { theme: 'neo-dark' },
  redux: { theme: 'redux' },
  'redux-dark': { theme: 'redux-dark' },
  // 基础主题：白底节点、浅灰边框(#cccccc)、深灰文字(#333333)、灰线条(#696969)、深灰箭头(#666666)
  basic: {
    theme: 'base',
    themeVariables: {
      primaryColor: '#ffffff',
      secondaryColor: '#ffffff',
      tertiaryColor: '#ffffff',
      primaryTextColor: '#333333',
      secondaryTextColor: '#333333',
      tertiaryTextColor: '#333333',
      primaryBorderColor: '#cccccc',
      secondaryBorderColor: '#cccccc',
      tertiaryBorderColor: '#cccccc',
      lineColor: '#696969',
      arrowheadColor: '#666666',
    },
  },
}

export interface MermaidRenderResult {
  /** 渲染出的 SVG，失败时为空 */
  svg: string
  /** 失败原因，成功时为空 */
  error: string
}

// 同一段代码换主题要重新渲染，缓存键里带上主题名
const renderCache = new Map<string, MermaidRenderResult>()
const MAX_CACHE_ENTRIES = 200

let appliedTheme: MermaidThemeName | null = null
let renderSeq = 0

// 切换 mermaid 全局主题，重复切换同一主题时不做处理
export function applyMermaidTheme(id: MermaidThemeName): void {
  if (appliedTheme === id) return
  const config = THEME_CONFIGS[id]
  mermaid.initialize({
    startOnLoad: false,
    theme: config.theme,
    themeVariables: config.themeVariables,
    securityLevel: 'loose',
  })
  appliedTheme = id
}

// 渲染 Mermaid 代码，同一主题下相同代码只渲染一次
export async function renderMermaid(code: string, themeId: MermaidThemeName): Promise<MermaidRenderResult> {
  const trimmed = code.trim()
  if (!trimmed) return { svg: '', error: '' }

  const key = `${themeId}\n${trimmed}`
  const cached = renderCache.get(key)
  if (cached) return cached

  applyMermaidTheme(themeId)
  const result: MermaidRenderResult = { svg: '', error: '' }
  const id = `mermaid-render-${++renderSeq}`
  try {
    const { svg } = await mermaid.render(id, trimmed)
    result.svg = svg
  } catch (e) {
    result.error = e instanceof Error ? e.message : '渲染失败，请检查 Mermaid 语法'
    // 渲染失败时 mermaid 会把临时容器留在 body 里，自己收掉
    document.getElementById(`d${id}`)?.remove()
  }

  if (renderCache.size >= MAX_CACHE_ENTRIES) renderCache.clear()
  renderCache.set(key, result)
  return result
}
