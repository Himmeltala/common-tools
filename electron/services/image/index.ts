/*
 * @Author: zhengrenfu
 * @Date: 2026-08-15
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-15
 * @FilePath: \electron\services\image\index.ts
 * @Description: 图片工具执行器注册，提供图片格式转换能力
 */

import { convertImage } from '@electron/services/media/ffmpeg.service'
import { toolExecutors, type ToolExecuteResult } from '@electron/services/tool-executor.service'

// 支持的目标输出格式
const SUPPORTED_FORMATS = ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'ico']

// 注册图片格式转换执行器
toolExecutors.register({
  id: 'image-convert',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const bytes = params.bytes as Uint8Array
    const inputFormat = String(params.inputFormat || '').toLowerCase()
    const targetFormat = String(params.targetFormat || '').toLowerCase()
    const quality = Number(params.quality) || 90

    if (!bytes || bytes.length === 0) {
      return { success: false, error: '未提供图片内容' }
    }
    if (!SUPPORTED_FORMATS.includes(targetFormat)) {
      return { success: false, error: `不支持的目标格式: ${targetFormat}` }
    }

    try {
      const result = await convertImage(bytes, inputFormat, targetFormat, quality)
      return {
        success: true,
        data: {
          bytes: Array.from(result.bytes),
          outputSize: result.bytes.length,
        },
      }
    } catch (e: any) {
      return { success: false, error: e.message || '图片转换失败' }
    }
  },
})
