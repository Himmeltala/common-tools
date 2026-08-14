/*
 * @Author: zhengrenfu
 * @Date: 2026-08-15
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-15
 * @FilePath: \electron\services\media\ffmpeg.service.ts
 * @Description: ffmpeg 服务，定位可执行文件、封装 spawn 调用与图片转码，供图片与视频工具复用
 */

import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'

/** 图片转换结果 */
export interface ImageConvertResult {
  /** 转换后的图片字节 */
  bytes: Uint8Array
}

/**
 * 构造有损格式的 ffmpeg 质量参数
 * @param targetFormat 目标格式扩展名
 * @param quality 质量 1-100
 * @returns ffmpeg 输出参数数组
 */
function buildQualityArgs(targetFormat: string, quality: number): string[] {
  const fmt = targetFormat.toLowerCase()
  const q = Math.max(1, Math.min(100, Math.round(quality)))
  switch (fmt) {
    case 'jpg':
    case 'jpeg': {
      // mjpeg 编码器 -q:v 范围 2-31，值越小质量越高
      const qv = 2 + Math.round(((100 - q) * 29) / 99)
      return ['-q:v', String(qv)]
    }
    case 'webp':
      return ['-quality', String(q)]
    case 'avif': {
      // libaom-av1 编码器 -crf 范围 0-63，值越小质量越高
      const crf = Math.round(((100 - q) * 63) / 99)
      return ['-crf', String(crf)]
    }
    default:
      return []
  }
}

/**
 * 定位 ffmpeg 可执行文件路径
 * Electron 打包后二进制被解包到 app.asar.unpacked，需重定向路径
 * @returns ffmpeg 可执行文件绝对路径
 */
export function resolveFfmpegPath(): string {
  if (!ffmpegStatic) {
    throw new Error('未找到 ffmpeg 可执行文件，请确认 ffmpeg-static 依赖安装完整')
  }
  return ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
}

/**
 * 运行 ffmpeg 并收集 stderr
 * @param args ffmpeg 参数数组
 * @returns 退出码与 stderr 文本
 */
function runFfmpeg(args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), args, { windowsHide: true })

    let stderr = ''
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', (code) => resolve({ code, stderr }))
    child.on('error', (err) => reject(err))
  })
}

/**
 * 将图片字节转换为目标格式
 * 输入写临时文件，ffmpeg 转码后读回输出并清理临时目录
 * @param inputBytes 输入图片字节
 * @param inputFormat 输入文件扩展名，用于 ffmpeg 格式探测
 * @param targetFormat 目标格式扩展名，如 jpg、png、webp
 * @param quality 质量 1-100，仅对 jpg/webp/avif 生效
 * @returns 转换后的图片字节
 */
export async function convertImage(
  inputBytes: Uint8Array,
  inputFormat: string,
  targetFormat: string,
  quality: number,
): Promise<ImageConvertResult> {
  const tempDir = mkdtempSync(join(tmpdir(), 'common-tools-img-'))
  const inputPath = join(tempDir, `input-${randomUUID()}.${inputFormat}`)
  const outputPath = join(tempDir, `output-${randomUUID()}.${targetFormat}`)

  try {
    writeFileSync(inputPath, Buffer.from(inputBytes))

    const args = ['-y', '-i', inputPath, '-frames:v', '1', ...buildQualityArgs(targetFormat, quality), outputPath]
    const { code, stderr } = await runFfmpeg(args)

    if (code !== 0) {
      throw new Error(stderr.trim() || `ffmpeg 退出码 ${code}`)
    }
    if (!existsSync(outputPath)) {
      throw new Error('转换失败，未生成输出文件')
    }

    const bytes = new Uint8Array(readFileSync(outputPath))
    return { bytes }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
