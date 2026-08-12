/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \electron\services\database\index.ts
 * @Description: 数据库工具类执行器注册
 */

import { toolExecutors, type ToolExecuteResult } from '@electron/services/tool-executor.service'

// 虚谷数据库默认 Schema
const SCHEMA = 'SYSDBA'

/** 列定义 */
interface ColumnDef {
  name: string
  type: string
  notnull: boolean
  comment: string
  defaultVal: string | null
}

/** 建表信息 */
interface TableInfo {
  table: string
  comment: string
  seed: number
  cols: ColumnDef[]
  indexes: [string, string][]
}

/**
 * 将 MySQL 列类型转换为虚谷数据库类型
 * @param t 原始类型字符串
 * @param isPk 是否为主键列
 * @returns 虚谷数据库类型
 */
function xuguType(t: string, isPk: boolean): string {
  const lower = t.toLowerCase()
  if (lower.startsWith('bigint')) return 'bigint'
  if (lower.startsWith('int')) return isPk ? 'bigint' : 'integer'
  if (lower.startsWith('tinyint')) return 'tinyint'
  if (lower.startsWith('longtext') || lower.startsWith('mediumtext') || lower.startsWith('tinytext')) {
    return 'text'
  }
  if (lower.startsWith('varchar')) {
    return lower.replace('varchar', 'varchar2')
  }
  return lower
}

/**
 * 解析 MySQL CREATE TABLE 语句
 * @param mysqlSql 单条 CREATE TABLE 语句
 * @returns 建表信息，解析失败返回 null
 */
function parseCreateTable(mysqlSql: string): TableInfo | null {
  const tableMatch = mysqlSql.match(/CREATE\s+TABLE\s+`?(?:\w+\.)?`?(\w+)`?/i)
  if (!tableMatch) return null
  const table = tableMatch[1]

  const commentMatch = mysqlSql.match(/COMMENT\s*=\s*'([^']*)'/i)
  const comment = commentMatch ? commentMatch[1] : ''

  const seedMatch = mysqlSql.match(/AUTO_INCREMENT\s*=\s*(\d+)/i)
  const seed = seedMatch ? parseInt(seedMatch[1], 10) : 1

  const createStart = mysqlSql.search(/CREATE\s+TABLE\s+`?\w+`?\s*\(/i)
  if (createStart === -1) return null

  const openParen = mysqlSql.indexOf('(', createStart)
  if (openParen === -1) return null

  let depth = 1
  let closeParen = -1
  for (let i = openParen + 1; i < mysqlSql.length && depth > 0; i++) {
    if (mysqlSql[i] === '(') depth++
    else if (mysqlSql[i] === ')') depth--
    if (depth === 0) {
      closeParen = i
      break
    }
  }
  if (closeParen === -1) return null

  const colsBlock = mysqlSql.substring(openParen + 1, closeParen)

  const cols: ColumnDef[] = []
  const colRegex = /`(\w+)`\s+(\w+(?:\([^)]*\))?)([\s\S]*?)(?=,\s*`|$)/g

  for (const cm of colsBlock.matchAll(colRegex)) {
    const name = cm[1]
    const type = cm[2]
    const rest = cm[3].replace(/\n/g, ' ').trim()

    const notnull = /NOT\s+NULL/i.test(rest)
    const cmtMatch = rest.match(/COMMENT\s+'([^']*)'/i)
    const colComment = cmtMatch ? cmtMatch[1] : ''
    const dfltMatch = rest.match(/DEFAULT\s+([^\s,]+(?:\([^)]*\))?)/i)
    const defaultVal = dfltMatch ? dfltMatch[1] : null

    cols.push({
      name,
      type,
      notnull,
      comment: colComment,
      defaultVal,
    })
  }

  const indexes: [string, string][] = []
  const idxRegex = /(?:INDEX|KEY)\s+`(\w+)`\s*\(\s*`(\w+)`\s*\)/gi
  for (const im of colsBlock.matchAll(idxRegex)) {
    indexes.push([im[1], im[2]])
  }

  return { table, comment, seed, cols, indexes }
}

/**
 * 根据建表信息生成虚谷数据库 DDL
 * @param info 建表信息
 * @returns 虚谷 DDL 文本
 */
function buildDdl(info: TableInfo): string {
  const full = `${SCHEMA}.${info.table.toUpperCase()}`

  const lines: string[] = []
  for (const c of info.cols) {
    const isPk = c.name.toLowerCase() === 'id'
    let seg = `${c.name.toUpperCase()} ${xuguType(c.type, isPk)}`
    if (c.notnull) {
      seg += ' not null'
    }
    if (c.defaultVal) {
      const d = c.defaultVal.split(/\s+ON\s+UPDATE/i)[0]
      if (d.toUpperCase() === 'CURRENT_TIMESTAMP') {
        seg += ' default CURRENT_TIMESTAMP'
      } else if (d.toUpperCase() !== 'NULL') {
        seg += ` default ${d}`
      }
    }
    if (c.comment) {
      seg += ` comment '${c.comment}'`
    }
    lines.push(seg)
  }

  let ddl = `DROP TABLE ${full};\n\n`
  ddl += `CREATE TABLE ${full}(\n${lines.join(',\n')}\n);\n`
  if (info.comment) {
    ddl += `comment on table ${info.table.toUpperCase()} is '${info.comment}';\n\n`
  }
  ddl += `alter table ${full} alter column ID BIGINT identity(${info.seed},1) primary key;\n`
  ddl += `alter table ${full} add constraint "PK_${info.table.toUpperCase()}" primary key(ID);\n`
  for (const [iname, icol] of info.indexes) {
    ddl += `create index ${iname.toUpperCase()} on ${full}(${icol.toUpperCase()});\n`
  }
  return ddl
}

/**
 * 将 MySQL DDL 文本转换为虚谷数据库 DDL
 * @param mysqlSql 原始 MySQL DDL 文本
 * @returns 转换后的虚谷 DDL 文本
 */
function convertDdl(mysqlSql: string): string {
  const parts = mysqlSql.split(/(?=CREATE\s+TABLE\s)/i)
  const ddls: string[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed || !/^CREATE\s+TABLE\s/i.test(trimmed)) continue
    const info = parseCreateTable(trimmed)
    if (info && info.cols.length > 0) {
      ddls.push(buildDdl(info))
    }
  }
  return ddls.join('\n')
}

// 注册 MySQL DDL 转虚谷执行器
toolExecutors.register({
  id: 'mysql-ddl-to-xugu',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const sql = params.sql as string
    if (!sql || !sql.trim()) {
      return { success: false, error: '未提供 SQL 内容' }
    }

    try {
      const ddl = convertDdl(sql)
      if (!ddl) {
        return { success: false, error: '未识别到有效的 CREATE TABLE 语句' }
      }
      return { success: true, data: { ddl } }
    } catch (e: any) {
      return { success: false, error: e.message || '转换失败' }
    }
  },
})
