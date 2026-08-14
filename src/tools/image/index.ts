/*
 * @Author: zhengrenfu
 * @Date: 2026-08-15
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-15
 * @FilePath: \src\tools\image\index.ts
 * @Description: 图片工具类别注册
 */

import type { ToolCategory } from '@/types/tool'
import ImageConvert from '@/tools/image/ImageConvert.vue'

// 图片工具类别
export const imageCategory: ToolCategory = {
  id: 'image',
  label: '图片工具',
  icon: 'Picture',
  tools: [
    {
      id: 'image-convert',
      label: '图片格式转换',
      description: '在 JPG、PNG、WebP、GIF、BMP、TIFF、AVIF、ICO 之间互转，支持质量调节',
      icon: 'PictureFilled',
      component: ImageConvert,
      executors: ['image-convert'],
    },
  ],
}
