# skillmgmt

[English](./README.md) | 简体中文

一个本地 Web 应用，用于在多个 AI 编码助手之间统一管理 **编码代理技能（skills）** —— 包括 Claude、Codex、Cursor 和 Antigravity。

它会扫描你机器上各个代理已安装的技能（每个代理技能目录下的 markdown 文件），将它们集中显示在一个库中，并允许你在不同代理之间编辑、同步与删除技能。

## 功能

- **技能发现** —— 扫描每个代理已知的技能路径（`~/.claude/skills`、`~/.codex/skills`、`~/.cursor/rules`、`~/.antigravity/skills` 等）。
- **漂移检测（Drift）** —— 当同一个技能存在于多个代理但 markdown 内容不一致时自动标记。
- **技能编辑** —— 按代理切换的 markdown 编辑器，包含 Content / Diff / Deploys 三个标签页。
- **跨代理同步** —— 一键将某个代理的技能内容推送到选定的其他代理。
- **删除技能** —— 从单个代理中移除技能。
- **批量选择** —— 多选行进行批量操作。
- **深色 / 浅色主题** 切换，偏好持久化在 `localStorage`。

UI 采用 **Console** 设计方向：密集、默认深色、Linear / Raycast 风格 —— Geist + Geist Mono 字体、青柠色强调色、琥珀色漂移指示。

## 技术栈

- **前端** —— React 19 + Vite 7 + TypeScript，图标使用 `lucide-react`。
- **后端** —— Vite dev-server 中间件（`vite.config.ts`）提供一个小型 REST API：
  - `GET /api/skills` —— 扫描并返回所有已发现的技能及按代理划分的内容映射
  - `PUT /api/skills/:id` —— 更新某个代理下技能的名称、摘要和内容
  - `DELETE /api/skills/:id` —— 从某个代理中移除技能
  - `POST /api/skills/sync` —— 将一个代理的技能内容复制到目标代理列表
- **无数据库** —— 所有状态保存在磁盘上的技能文件中，应用本质上是一个文件系统之上的轻量编辑器。

## 项目结构

```
src/
  App.tsx          # 主界面（顶部栏、侧边栏、表格、抽屉）
  styles.css       # Console 设计 token + 深色 / 浅色主题
  agentIcons.tsx   # Claude / Codex / Cursor / Antigravity 的 SVG 图标
  data.ts          # 代理元信息（路径、颜色）
  types.ts         # 共享 TS 类型
  main.tsx         # React 根节点
server/
  skillScanner.ts  # 文件系统扫描器 —— 读取每个代理的技能目录
  skillStore.ts    # CRUD + 跨代理同步
vite.config.ts     # 开发服务器 + /api/* 中间件
```

## 快速开始

```bash
npm install
npm run dev
```

然后打开 Vite 输出的地址（如固定端口则默认为 `http://127.0.0.1:5178`，否则使用下一个空闲端口）。

构建生产版本：

```bash
npm run build
npm run preview
```

## 注意事项

- 扫描器读取的是你机器上的真实文件。编辑和删除会直接写回磁盘 —— 没有撤销功能，请先备份重要内容。
- "漂移（Drift）" 通过比较同一技能在已安装的多个代理之间的 markdown 内容计算得出。仅安装在一个代理上的技能始终视为 "Synced"。
- 四个代理的列表在 `src/data.ts` 中硬编码 —— 如需支持更多代理，请扩展 `src/types.ts` 中的 `AgentId` 联合类型，并在数据文件中添加对应条目。
