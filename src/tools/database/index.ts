/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\database\index.ts
 * @Description: 数据库转换工具类别注册
 */

import type { ToolCategory } from '@/types/tool'
import MysqlDdlToXugu from '@/tools/database/MysqlDdlToXugu.vue'

// 数据库转换工具类别
export const databaseCategory: ToolCategory = {
  id: 'database',
  label: '数据库转换',
  icon: 'Coin',
  tools: [
    {
      id: 'mysql-ddl-to-xugu',
      label: 'MySQL DDL 转虚谷',
      description: '将 MySQL 建表语句转换为虚谷数据库 DDL',
      icon: 'Switch',
      component: MysqlDdlToXugu,
      executors: ['run-python'],
    },
  ],
}
