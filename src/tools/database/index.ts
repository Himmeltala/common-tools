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
import FieldToXugu from '@/tools/database/FieldToXugu.vue'
import InsertToCsv from '@/tools/database/InsertToCsv.vue'

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
      executors: ['mysql-ddl-to-xugu'],
    },
    {
      id: 'field-to-xugu',
      label: 'SQL 转虚谷风格',
      description: '将 MySQL 风格 SQL 标识符转为虚谷大写格式（去反引号、字段名/表名大写）',
      icon: 'List',
      component: FieldToXugu,
    },
    {
      id: 'insert-to-csv',
      label: 'INSERT 转 CSV',
      description: '将 MySQL INSERT 语句转换为虚谷可导入的 CSV 格式（字段名大写）',
      icon: 'Tickets',
      component: InsertToCsv,
    },
  ],
}
