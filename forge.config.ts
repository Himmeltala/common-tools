import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'

const config: ForgeConfig = {
  packagerConfig: {
    name: 'CommonTools',
    executableName: 'common-tools',
    asar: {
      unpack: '**/node_modules/ffmpeg-static/**',
    },
    appCopyright: 'Copyright © 2026',
    extraResource: ['assets'],
  },
  makers: [
    new MakerSquirrel({
      name: 'common-tools',
      title: '常用工具箱',
      authors: 'zhengrenfu',
      description: 'Windows 桌面工具箱，集成 Markdown 预览、PDF 转换等常用工具',
    }),
    new MakerZIP({}, ['win32']),
  ],
}

export default config
