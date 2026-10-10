/*
 * @Author: zhengrenfu
 * @Date: 2026-10-10
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-10-10
 * @FilePath: \electron\services\markdown\image-protocol.ts
 * @Description: mdimg 协议，把本地图片提供给渲染进程与 PDF 窗口
 */

import { protocol } from 'electron'
import { readFile } from 'fs/promises'
import { decodeImageUrl, imageMime, isReadableImage } from '@electron/services/markdown/image-resolver'

/** 必须在 app ready 之前调用 */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'mdimg',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

/** 必须在 app ready 之后调用 */
export function handleImageProtocol(): void {
  protocol.handle('mdimg', async (request) => {
    const filePath = decodeImageUrl(request.url)
    if (!filePath || !isReadableImage(filePath)) {
      return new Response(null, { status: 404 })
    }
    try {
      return new Response(new Uint8Array(await readFile(filePath)), {
        headers: { 'Content-Type': imageMime(filePath) },
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}
