/*
 * @Author: zhengrenfu
 * @Date: 2026-07-20
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \electron\services\core\data-dir.service.ts
 * @Description: 数据目录初始化服务，首次启动时同步模板文件
 */

import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

/** 版本升级时强制同步的文件 */
const FORCE_SYNC_FILES = new Set(['settings_schema.json'])

/** 获取应用数据目录路径，取自 package.json 的 productName */
export function getDataDir(): string {
  return app.getPath('userData')
}

/**
 * 确保数据目录存在，首次启动时将模板文件同步过去
 * @param sourceRoot 项目根目录或 resources 路径
 * @returns 数据目录路径
 */
export function ensureDataDir(sourceRoot: string): string {
  const dataDir = getDataDir()
  const assetDir = join(dataDir, 'assets')
  mkdirSync(assetDir, { recursive: true })

  const sourceAssetDir = join(sourceRoot, 'assets')
  if (existsSync(sourceAssetDir)) {
    syncTemplates(sourceAssetDir, assetDir, dataDir)
  }

  return dataDir
}

/**
 * 将模板文件从源码 assets 目录同步到用户数据目录
 * @param sourceAssetDir 源码 assets 目录
 * @param targetAssetDir 用户数据 assets 目录
 * @param dataDir 用户数据根目录
 */
function syncTemplates(sourceAssetDir: string, targetAssetDir: string, dataDir: string): void {
  const version = app.getVersion()
  const verFile = join(dataDir, '.version')
  let oldVersion: string | null = null
  if (existsSync(verFile)) {
    oldVersion = readFileSync(verFile, 'utf-8').trim()
  }
  const isUpgrade = oldVersion !== null && oldVersion !== version

  try {
    for (const name of readdirSync(sourceAssetDir)) {
      const src = join(sourceAssetDir, name)
      const dst = join(targetAssetDir, name)
      const s = statSync(src)
      if (!s.isFile()) continue

      if (!existsSync(dst)) {
        writeFileSync(dst, readFileSync(src))
      } else if (FORCE_SYNC_FILES.has(name)) {
        writeFileSync(dst, readFileSync(src))
      } else if (isUpgrade) {
        writeFileSync(dst, readFileSync(src))
      }
    }
  } catch {
    // ignore
  }

  writeFileSync(verFile, version, 'utf-8')
}
