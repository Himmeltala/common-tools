/*
 * @Author: zhengrenfu
 * @Date: 2026-07-15
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \scripts\copy-out.js
 * @Description: 将打包后的 common-tools 目录复制到目标路径
 */

import { existsSync, cpSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('out/common-tools-win32-x64')
const dst = 'E:/常用工具箱/'

if (!existsSync(src)) {
  console.error(`[copy-out] 错误: ${src} 目录不存在，请先执行 npm run pack`)
  process.exit(1)
}

console.log(`[copy-out] 删除旧目录: ${dst}`)
rmSync(dst, { recursive: true, force: true })

console.log(`[copy-out] 复制 ${src} -> ${dst}`)
cpSync(src, dst, { recursive: true })

console.log('[copy-out] 完成')
