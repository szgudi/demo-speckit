# Todo List 设计

## 目标

交付一个中文 Todo List：React 单页应用通过版本化 Node.js API 将数据持久化到 MySQL，支持新增、查询、编辑、完成/恢复和确认删除。

## 架构

采用 pnpm workspace。`packages/contracts` 是前后端共享的 Zod 运行时契约；`apps/api` 按 Express 路由、业务服务、MySQL 仓储分层；`apps/web` 只通过 HTTP 客户端访问 API。MySQL 使用 `todos` 表和参数化查询，测试使用独立的 `_test` 数据库。

## 交互与错误

页面明确区分加载、空状态、成功、校验失败和网络失败；写入成功后只使用服务器返回对象更新状态。收到 `TODO_NOT_FOUND` 时提示并重新加载，删除确认在确认前不发请求。所有控件、错误和通知均提供中文可访问文本。

## 测试

契约和前端使用 Vitest，API 使用 Supertest + 测试 MySQL，端到端使用 Playwright 启动真实 Vite 与 API。质量门禁为 `pnpm typecheck`、`pnpm test`、`pnpm test:api`、`pnpm test:e2e`。
