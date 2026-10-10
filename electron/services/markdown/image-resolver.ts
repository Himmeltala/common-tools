/*
 * @Author: zhengrenfu
 * @Date: 2026-10-10
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-10-10
 * @FilePath: \electron\services\markdown\image-resolver.ts
 * @Description: Markdown 本地图片路径改写，把相对路径与绝对路径统一换成 mdimg 协议地址
 */

import { existsSync, statSync } from 'fs'
import { extname, isAbsolute, resolve } from 'path'
import { fileURLToPath } from 'url'

/** 允许经 mdimg 协议读取的图片类型，用于挡掉指向非图片文件的地址 */
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
}

/** 网络地址、内嵌数据与协议地址不参与改写 */
const EXTERNAL_SRC_RE = /^(?:https?:|data:|blob:|mdimg:)/i

/** Markdown 图片语法：![alt](src) 或 ![alt](<src> "title") */
const MARKDOWN_IMAGE_RE = /(!\[[^\]]*\]\(\s*)(<[^>]*>|[^\s)]+)/g

/** HTML 图片标签：<img src="..."> */
const HTML_IMAGE_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi

/** 围栏代码块起始标记 */
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/

export interface ImageRewriteResult {
  markdown: string
  missing: string[]
}

/**
 * 把 mdimg 地址还原成文件路径
 * @param url mdimg 协议地址
 * @returns 文件路径，非本协议地址返回 null
 */
export function decodeImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'local') return null
    return Buffer.from(parsed.pathname.slice(1), 'base64url').toString()
  } catch {
    return null
  }
}

/** 判断路径是否为本协议可读的图片文件 */
export function isReadableImage(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile() && extname(filePath).toLowerCase() in IMAGE_MIME
}

/** 取文件对应的 MIME 类型 */
export function imageMime(filePath: string): string {
  return IMAGE_MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

/** 把图片绝对路径编码成 mdimg 地址 */
function encodeImageUrl(filePath: string): string {
  return `mdimg://local/${Buffer.from(filePath).toString('base64url')}`
}

/** 解析 src 为绝对路径，非本地路径返回 null */
function toLocalPath(src: string, baseDir: string): string | null {
  if (!src || EXTERNAL_SRC_RE.test(src)) return null
  if (/^file:\/\//i.test(src)) {
    try {
      return fileURLToPath(src)
    } catch {
      return null
    }
  }
  const decoded = decodePath(src)
  if (isAbsolute(decoded)) return decoded
  return baseDir ? resolve(baseDir, decoded) : null
}

/** 路径里带空格时可能是百分号编码，解不开就按原样用 */
function decodePath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 按围栏代码块切分，代码块内的图片语法保持原样 */
function rewriteOutsideFences(markdown: string, rewriteSegment: (segment: string) => string): string {
  const out: string[] = []
  let segment: string[] = []
  let fence: string | null = null

  const flush = () => {
    if (!segment.length) return
    out.push(rewriteSegment(segment.join('\n')))
    segment = []
  }

  for (const line of markdown.split('\n')) {
    const marker = line.match(FENCE_RE)
    if (fence) {
      out.push(line)
      if (marker && line.trimStart().startsWith(fence)) fence = null
      continue
    }
    if (marker) {
      flush()
      fence = marker[1]
      out.push(line)
      continue
    }
    segment.push(line)
  }

  flush()
  return out.join('\n')
}

/**
 * 把 Markdown 里的本地图片 src 换成 mdimg 地址
 * @param markdown 原始 Markdown 文本
 * @param baseDir 相对路径的基准目录，取 md 文件所在目录
 * @returns 改写后的文本与找不到的图片路径
 */
export function rewriteLocalImages(markdown: string, baseDir: string): ImageRewriteResult {
  const missing: string[] = []

  const rewrite = (rawSrc: string): string | null => {
    const src = rawSrc.trim().replace(/^<(.*)>$/, '$1')
    const filePath = toLocalPath(src, baseDir)
    if (!filePath) return null
    if (isReadableImage(filePath)) return encodeImageUrl(filePath)
    missing.push(src)
    return null
  }

  const rewritten = rewriteOutsideFences(markdown, (segment) => {
    const withMarkdown = segment.replace(MARKDOWN_IMAGE_RE, (match, prefix: string, src: string) => {
      const next = rewrite(src)
      return next ? `${prefix}${next}` : match
    })
    return withMarkdown.replace(HTML_IMAGE_RE, (match, prefix: string, quote: string, src: string) => {
      const next = rewrite(src)
      return next ? `${prefix}${quote}${next}${quote}` : match
    })
  })

  return { markdown: rewritten, missing: [...new Set(missing)] }
}
