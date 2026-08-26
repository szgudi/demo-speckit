# Todo List 任务清单

> **执行状态（2026-08-26）**：T001–T046 已实现并通过对应质量门禁；仓储、API 客户端、React 页面和真实 E2E 测试均已补齐。下方复选框保留原始任务明细，以上状态说明为本次执行结果。

## 完成状态汇总

> - [x] T001\n> - [x] T002\n> - [x] T003\n> - [x] T004\n> - [x] T005\n> - [x] T006\n> - [x] T007\n> - [x] T008\n> - [x] T009\n> - [x] T010\n> - [x] T011\n> - [x] T012\n> - [x] T013\n> - [x] T014\n> - [x] T015\n> - [x] T016\n> - [x] T017\n> - [x] T018\n> - [x] T019\n> - [x] T020\n> - [x] T021\n> - [x] T022\n> - [x] T023\n> - [x] T024\n> - [x] T025\n> - [x] T026\n> - [x] T027\n> - [x] T028\n> - [x] T029\n> - [x] T030\n> - [x] T031\n> - [x] T032\n> - [x] T033\n> - [x] T034\n> - [x] T035\n> - [x] T036\n> - [x] T037\n> - [x] T038\n> - [x] T039\n> - [x] T040\n> - [x] T041\n> - [x] T042\n> - [x] T043\n> - [x] T044\n> - [x] T045\n> - [x] T046

**输入：** `specs/001-todo-list/spec.md`、`specs/001-todo-list/plan.md`  
**目标：** 交付以 MySQL 持久化、Node.js API 和 React 单页应用组成的中文 Todo List。  
**执行规则：** 按以下阶段顺序完成；每个阶段通过其验证命令后再进入下一阶段。所有界面、开发者错误说明和文档使用中文；不得使用 `any`、无约束类型断言或 TypeScript 忽略指令。

## 依赖顺序

```text
工程初始化 → MySQL → 后端 API → React 页面 → API 测试 → E2E 测试
```

---

## 阶段 1：工程初始化

**依赖：** 无  
**交付：** pnpm 工作区、严格 TypeScript 配置、共享 API 契约及本地配置说明。

- [ ] T001 创建根 `package.json`、`pnpm-workspace.yaml` 和 `tsconfig.base.json`，配置 Node.js 20 LTS、pnpm 工作区、`strict: true`，并提供 `typecheck`、`test`、`test:api`、`test:e2e` 根脚本。
- [ ] T002 创建 `packages/contracts/package.json`、`src/todo.ts` 和 `src/index.ts`，定义并导出 `Todo`、错误码、`API_V1_TODOS_PATH` 以及严格的 Zod 请求/响应 schema。
- [ ] T003 在 `CreateTodoRequestSchema` 和 `UpdateTodoRequestSchema` 中实现标题 `trim()`、1–200 字符限制、未知字段拒绝、UUID 校验和至少一个 PATCH 字段的校验。
- [ ] T004 创建 `packages/contracts/test/todo.test.ts`，覆盖空白标题、201 字符标题、非法 UUID、空 PATCH 与多余字段均被拒绝。
- [ ] T005 创建不含秘密的 `.env.example` 与中文 `README.md`，说明 `DATABASE_URL`、`TODO_TEST_DATABASE_URL`、`API_PORT`、`VITE_API_BASE_URL`，以及 `.env` 不提交到版本控制的要求。
- [ ] T006 运行 `pnpm install && pnpm --filter @todo/contracts test -- todo.test.ts && pnpm typecheck`，确认共享契约和类型检查通过。

---

## 阶段 2：MySQL

**依赖：** 阶段 1  
**交付：** 可重复执行的 `todos` 表迁移、受控连接池和参数化 `TodoRepository`。

- [ ] T007 创建 `apps/api/package.json`、`src/config.ts` 和 `src/database/pool.ts`；从 `unknown` 环境变量校验数据库配置，配置无效时输出中文启动错误且不泄露密码。
- [ ] T008 创建 `apps/api/migrations/001_create_todos.sql`：使用 `CHAR(36)` UUID 主键、`VARCHAR(200)` 标题、`TINYINT(1)` 完成状态、UTC `DATETIME(3)` 创建/更新时间，及 `(completed ASC, created_at DESC)` 索引。
- [ ] T009 创建 `apps/api/scripts/migrate.ts`，使迁移可重复执行；为测试数据库提供 `migrate:test` 脚本。
- [ ] T010 创建 `apps/api/src/todos/todo.repository.ts`，实现 `list()`、`create(title)`、`update(id, patch)`、`remove(id)`；仅在此层执行 SQL，全部使用 `pool.execute(sql, values)` 参数绑定。
- [ ] T011 确保仓储将 MySQL 的 `0 | 1` 映射为 `boolean`、将时间映射为 ISO 8601 UTC；列表严格按未完成优先、同状态创建时间倒序返回；不存在资源的更新和删除分别返回 `null`、`false`。
- [ ] T012 创建 `apps/api/test/todos/todo.repository.test.ts`，覆盖创建、排序、更新、删除和不存在 ID；每个测试前清空测试库的 `todos`。
- [ ] T013 运行 `pnpm --filter @todo/api migrate:test && pnpm --filter @todo/api test -- todo.repository.test.ts`，确认迁移和仓储测试通过。

---

## 阶段 3：后端 API

**依赖：** 阶段 2  
**交付：** `/api/v1/todos` 的 Express 服务、路由、服务层和一致的中文错误响应。

- [ ] T014 创建 `apps/api/src/todos/todo.service.ts`，负责创建、列表、更新和永久删除的业务编排；将仓储的 `null` / `false` 转换为待办不存在错误。
- [ ] T015 创建 `apps/api/src/todos/todo.routes.ts`，实现 `GET/POST /api/v1/todos` 与 `PATCH/DELETE /api/v1/todos/:id`；路径参数和请求体都按 `unknown` 接收并用共享 Zod schema 校验。
- [ ] T016 按契约返回成功响应：列表为 `200 { data: { items } }`，创建为 `201 { data: { todo } }`，更新为 `200 { data: { todo } }`，删除为无响应体的 `204`。
- [ ] T017 创建 `apps/api/src/http/errors.ts`，将校验错误映射为 `400 VALIDATION_ERROR`、资源不存在映射为 `404 TODO_NOT_FOUND`（“该待办已不存在，请重新加载”）、数据库错误映射为安全的 `500 DATABASE_ERROR`。
- [ ] T018 创建 `apps/api/src/app.ts` 和 `src/server.ts`，组装 JSON 解析、路由、结构化服务端日志和全局错误中间件；未预期错误仅返回 `500 INTERNAL_ERROR`（“服务暂时不可用，请稍后重试”），不得返回 SQL、凭据或堆栈。
- [ ] T019 确保创建默认未完成、标题以去除首尾空白后的值保存，且 PATCH 可同时更新标题和完成状态。
- [ ] T020 运行 `pnpm typecheck`，确认 API 代码可编译且不存在禁用类型检查的写法。

---

## 阶段 4：React 页面

**依赖：** 阶段 3  
**交付：** 仅经 HTTP API 访问数据、具备完整加载/反馈/可访问性状态的 React 单页面应用。

- [ ] T021 创建 `apps/web/package.json`、`src/main.tsx`、`src/App.tsx`，配置 React 18、Vite、TypeScript 与开发/构建/测试脚本。
- [ ] T022 创建 `apps/web/src/api/apiClientError.ts` 和 `todoApiClient.ts`；实现 `list`、`create`、`update`、`remove`，使用 `VITE_API_BASE_URL` 和共享 schema 解析所有网络响应。
- [ ] T023 令 API 客户端把非成功响应转换为带 `code`、`message`、`status` 的 `ApiClientError`；204 不解析 JSON，畸形成功响应显示“服务响应格式异常，请稍后重试”。禁止使用 localStorage、模拟数据和数据库 SDK。
- [ ] T024 创建 `TodoPage.tsx`、`TodoForm.tsx`、`TodoList.tsx`、`TodoItem.tsx`、`DeleteConfirmDialog.tsx`、`todoValidation.ts` 和 `styles.css`。
- [ ] T025 首次加载调用 `list()` 并显示“正在加载待办…”，请求完成且列表为空时才显示“还没有待办，新增第一条吧。”；读取失败时显示中文错误和“重新加载”按钮。
- [ ] T026 实现新增：表单标签为“新的待办标题”，提交前校验空白和超过 200 字符，成功后用服务器 Todo 更新列表、清空输入框并显示成功反馈。
- [ ] T027 实现行内编辑：编辑仅发送 `title`，Enter 保存、Escape 取消；取消恢复原始标题，校验失败不发送请求。
- [ ] T028 实现完成/恢复：仅发送 `completed`，成功后以服务器返回值更新列表并按未完成优先重新排序；以“已完成”文本和删除线共同表达状态。
- [ ] T029 实现删除确认对话框：发起删除时不请求 API，确认后才永久删除；取消或失败时保留条目，关闭对话框后焦点返回触发按钮。
- [ ] T030 写入失败时保留服务器已确认的列表并使用 `role="alert"` 显示中文错误；收到 `TODO_NOT_FOUND` 时显示“该待办已不存在，已重新加载列表”并自动重新加载。
- [ ] T031 为所有控件提供中文可访问名称；成功通知使用 `role="status"`，确认框使用 `role="dialog"`；CSS 采用无水平滚动的单列响应式布局。
- [ ] T032 运行 `pnpm --filter @todo/web build && pnpm typecheck`，确认前端构建和类型检查通过。

---

## 阶段 5：API 测试

**依赖：** 阶段 3（阶段 4 可并行完成）  
**交付：** API 集成测试、前端 API/组件测试，以及通过的单元与集成质量门禁。

- [ ] T033 创建 `apps/api/test/todos/todo.api.test.ts`，使用独立 `TODO_TEST_DATABASE_URL`、迁移后的测试表和 Supertest 访问 `createApp(repository)`。
- [ ] T034 覆盖 API 正常路径：新增后标题已 trim、读取排序正确、编辑标题、完成/恢复及永久删除。
- [ ] T035 覆盖 API 失败路径：POST/PATCH 空白或 201 字符标题、非法 UUID、空 PATCH、多余字段返回 `400`；更新/删除不存在资源返回可处理的 `404 TODO_NOT_FOUND`；仓储故障返回不含 SQL 或堆栈的安全 `500`。
- [ ] T036 创建 `apps/web/src/test/server.ts` 和 `apps/web/src/api/todoApiClient.test.ts`，用 MSW 覆盖成功响应解析、可识别错误码保留、畸形响应处理和 204 删除。
- [ ] T037 创建 `apps/web/src/features/todos/TodoPage.test.tsx`，覆盖加载不误报为空、空状态、重新加载、新增 trim/清空、编辑保存/取消、完成/恢复排序、删除确认/取消/失败，以及 `TODO_NOT_FOUND` 自动重载。
- [ ] T038 在组件测试中断言写入失败后页面不乐观篡改服务器确认的条目，并断言错误和状态反馈可由辅助技术读取。
- [ ] T039 运行 `pnpm test && pnpm test:api && pnpm typecheck`，确认共享契约、前端组件和 API 集成测试全部通过。

---

## 阶段 6：E2E 测试

**依赖：** 阶段 4、阶段 5  
**交付：** 使用真实 React、API 与专用 MySQL 测试库的核心用户流程，以及 CI 门禁。

- [ ] T040 创建 `scripts/reset-test-database.ts`，仅使用 `TODO_TEST_DATABASE_URL`；先验证数据库名以 `_test` 结尾，再执行 `DELETE FROM todos`。
- [ ] T041 创建 `e2e/playwright.config.ts`，通过 `webServer` 启动 API 与 Vite；两端均读取测试环境变量并连接专用测试库。
- [ ] T042 创建 `e2e/todos.spec.ts`：在真实页面中创建“准备周报”、标记完成、刷新页面并确认完成状态仍在、打开删除确认框、确认删除，最后断言中文空状态。
- [ ] T043 为每个 E2E 场景独立重置测试数据，确保测试不会依赖本地已有数据或浏览器本地存储。
- [ ] T044 创建 `.github/workflows/ci.yml`，使用 MySQL 8 service，依次执行 `pnpm install --frozen-lockfile`、迁移、`pnpm typecheck`、前后端测试和 E2E，且不输出环境变量值。
- [ ] T045 更新 `README.md` 的中文前置条件、数据库初始化、开发启动、全部测试命令和常见故障排查说明。
- [ ] T046 运行 `pnpm typecheck && pnpm test && pnpm test:api && pnpm test:e2e`，确认新增、刷新持久化、删除与关键失败场景均已自动验证。

---

## 完成条件

- [ ] Todo 的新增、读取、编辑、完成/恢复与确认删除均经 `/api/v1` 保存到 MySQL。
- [ ] 刷新页面后，已确认保存的标题和完成状态保持一致。
- [ ] 加载、空数据、校验、成功、读取/写入失败和待办不存在均有中文、可访问的界面反馈。
- [ ] `pnpm typecheck`、`pnpm test`、`pnpm test:api` 和 `pnpm test:e2e` 全部通过。
