# 常用工具箱

基于 Electron + Vue 3 + Vite + TypeScript 的 Windows 桌面工具箱，集成 Markdown 预览、PDF 转换等常用工具，支持按类别扩展。

## 功能

### Markdown 工具

- 编辑并实时预览 Markdown 内容，支持代码高亮
- 打开本地 `.md` 文件编辑
- Markdown 转 PDF，支持亮色/暗色/GitHub/简约四种输出主题
- PDF 输出前实时预览主题效果

### 系统能力

- 暗色 / 亮色主题切换（基于 Element Plus）
- Windows 原生通知（Electron Notification API）
- 通知持久化（已读/未读状态）
- 通用 Key-Value 存储
- 动态设置表单（基于 JSON Schema）

### 扩展机制

- 工具类别注册表模式（ToolCategoryRegistry），新增类别只需注册即可
- 工具执行器模式（ToolExecutor），主进程能力按需接入

## 技术栈

| 技术         | 用途          |
| ------------ | ------------- |
| Electron     | 桌面应用框架  |
| Vue 3        | 前端 UI 框架  |
| Vite         | 构建工具      |
| TypeScript   | 语言          |
| Element Plus | UI 组件库     |
| Pinia        | 状态管理      |
| Vue Router   | 路由          |
| markdown-it  | Markdown 解析 |
| highlight.js | 代码语法高亮  |

## 项目结构

```
常用工具箱/
├── src/                       # 前端代码
│   ├── modals/                # 全局弹窗
│   ├── views/                 # 页面视图
│   ├── tools/                 # 工具注册与实现
│   │   └── markdown/          # Markdown 工具类别
│   ├── types/                 # TypeScript 类型定义
│   ├── composables/           # 组合式函数
│   ├── utils/                 # 工具函数
│   ├── router/                # 路由配置
│   ├── App.vue                # 根组件
│   └── main.ts                # 前端入口
├── electron/                  # 主进程
│   ├── main.ts                # Electron 主进程入口
│   ├── preload.ts             # 预加载脚本（IPC 桥接 + 白名单）
│   └── services/              # 业务逻辑
│       ├── core/              # 基础设施（设置/存储/数据目录）
│       ├── notification.service.ts
│       ├── sys-notification.service.ts  # Windows 原生通知
│       └── tool-executor.service.ts      # 工具执行器注册表
├── assets/                    # 数据文件
│   ├── settings.json          # 应用设置
│   └── settings_schema.json   # 设置界面配置
└── .eslint-plugin-local/      # 自定义 ESLint 规则
```

## 开发

### 安装

```bash
npm install
```

### 运行（热重载）

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 打包

```bash
npm run make
npm run pack
```

## 架构

```
渲染进程 (Vue 3)                    主进程 (Electron Main)
  Vue 组件                            IPC Handlers
    │                                    │
  注册表 ◄── preload.ts ──────────── Services
    │                        │          ├── AppSettings
  Element Plus UI            │          ├── NotificationService
                             │          ├── SysNotification (Windows Toast)
                             │          ├── ToolExecutorRegistry
                             │          ├── StoreService
                             │          └── DataDirService
                             │
                  contextBridge (安全 IPC + 白名单)
```

### 设计特点

- **注册表模式**：`ToolCategoryRegistry` 管理工具类别，新增类别无需修改框架代码
- **执行器模式**：`ToolExecutor` 接口抽象主进程工具操作，通过 `toolExecutors` 注册
- **IPC 白名单**：preload 层校验 channel 前缀，非白名单通道拒绝调用
- **设置系统**：点号嵌套 Key-Value 存储 + JSON Schema 驱动 UI，自动持久化
- **原生通知**：Electron Notification API，支持静默/常驻模式，通知点击聚焦窗口

## 新增工具类别

1. 创建 `src/tools/<category>/` 目录
2. 实现工具 Vue 组件
3. 创建 `index.ts` 导出 `ToolCategory` 对象
4. 在 `src/tools/index.ts` 中调用 `toolRegistry.register()`
5. 如需主进程能力，在 `electron/services/tool-executor.service.ts` 注册 `ToolExecutor`
