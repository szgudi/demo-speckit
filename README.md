# Todo List

中文 React Todo List，使用 Node.js API 和 MySQL 持久化。

## 前置条件

需要 Node.js 20+、pnpm、MySQL 8。复制 `.env.example` 为 `.env`，填写 `DATABASE_URL` 与 `TODO_TEST_DATABASE_URL`；测试库名必须以 `_test` 结尾。`.env` 不得提交。

## 启动与测试

```bash
pnpm install
pnpm --filter @todo/api migrate
pnpm --filter @todo/api dev
pnpm --filter @todo/web dev
pnpm typecheck && pnpm test && pnpm test:api && pnpm test:e2e
```

API 默认监听 `API_PORT`，前端通过 `VITE_API_BASE_URL` 访问。若测试数据库不可用，请检查 MySQL 用户权限、数据库名称和环境变量。
