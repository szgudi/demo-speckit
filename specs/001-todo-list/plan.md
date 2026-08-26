# Todo List 实现计划

> **供自动化执行代理使用：** 实现本计划时必须逐任务执行，并以复选框记录进度；建议使用 `subagent-driven-development` 或 `executing-plans`，在每个任务结束时完成评审。

**目标：** 交付一个中文 React 单页 Todo List，通过版本化 Node.js HTTP API 将新增、查询、编辑、完成状态切换和永久删除持久化到 MySQL。

**架构：** 仓库采用 pnpm 工作区：`apps/web` 是 React 界面，`apps/api` 是 Node.js API，`packages/contracts` 是唯一的跨边界类型与运行时校验契约。API 通过路由、服务和仓储三层隔离 HTTP、业务规则与 MySQL；前端只经由 `TodoApiClient` 请求 `/api/v1`，以服务器确认结果更新界面，绝不直连 MySQL 或以本地存储充当数据源。

**技术栈：** Node.js 20 LTS、TypeScript、pnpm、React 18、Vite、Express、MySQL 8、`mysql2/promise`、Zod、Vitest、React Testing Library、Supertest、Playwright。

## 全局约束

- 前端必须是 React + TypeScript 单页面应用；后端必须是 Node.js + TypeScript；生产业务数据唯一持久化来源为 MySQL。
- 界面、开发者错误信息、文档和代码注释均使用中文；变量、类型、路由和文件名可使用行业惯例英文名。
- 前端仅呈现界面、处理交互并调用 API；后端负责业务规则、外部输入校验和 MySQL 访问；前端不得连接数据库。
- 所有 API 均以 `/api/v1` 为前缀，并使用共享契约定义请求、成功响应、错误响应和状态码。
- 不得使用 `any`、无约束类型断言或 TypeScript 忽略指令；边界数据先按 `unknown` 接收，再经 Zod 校验缩小类型。
- 仓储层必须使用 `mysql2` 参数绑定；错误响应不得暴露凭据、SQL 或内部堆栈。
- 标题保存前执行 `trim()`，长度必须为 1–200 个字符；创建默认未完成；删除为永久删除；不存在的待办更新或删除必须返回可识别错误并触发前端重载。
- 不实现用户、登录、多列表、筛选、优先级、离线同步、撤销或批量操作。
- 所有 API 测试、端到端测试和 TypeScript 类型检查通过前，不得标记功能完成。

---

## 目录与职责

| 路径 | 职责 |
| --- | --- |
| `package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json` | 工作区、统一脚本与严格 TypeScript 配置。 |
| `packages/contracts/src/todo.ts` | Todo DTO、请求/响应 Zod schema、错误码与 API 路径的单一来源。 |
| `apps/api/src/app.ts` | Express 应用组装、JSON 解析、路由和统一错误处理。 |
| `apps/api/src/todos/todo.repository.ts` | 唯一允许执行 SQL 的数据访问边界。 |
| `apps/api/src/todos/todo.service.ts` | 标题规范化、未找到转换和业务操作。 |
| `apps/api/src/todos/todo.routes.ts` | HTTP 参数解析、状态码和契约响应。 |
| `apps/api/migrations/001_create_todos.sql` | 可重复执行的 MySQL 表和索引定义。 |
| `apps/web/src/api/todoApiClient.ts` | 前端唯一 HTTP 客户端，解析共享契约并转换 API 错误。 |
| `apps/web/src/features/todos/*` | 获取数据、表单、列表项、编辑、删除确认及可访问状态展示。 |
| `apps/*/test`、`e2e/todos.spec.ts` | 单元、API 集成和真实前后端 E2E 测试。 |
| `.env.example`、`README.md` | 不含秘密的中文配置和启动说明。 |

## 数据模型

MySQL 表名为 `todos`。时间使用数据库生成的 UTC `DATETIME(3)`；API 将其序列化为 ISO 8601 UTC 字符串。`completed` 以 `TINYINT(1)` 存储，仓储映射为 boolean。ID 由后端 `randomUUID()` 生成，避免让客户端决定资源标识。

| 列 | 类型 / 约束 | 含义 |
| --- | --- | --- |
| `id` | `CHAR(36) PRIMARY KEY` | 稳定 UUID。 |
| `title` | `VARCHAR(200) NOT NULL` | 已去除首尾空白的待办标题。 |
| `completed` | `TINYINT(1) NOT NULL DEFAULT 0` | 0 为未完成，1 为已完成。 |
| `created_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` | 创建时间。 |
| `updated_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)` | 最近修改时间。 |
| `idx_todos_completed_created` | `(completed ASC, created_at DESC)` | 支持未完成优先、同状态最新优先的列表读取。 |

## API 契约（v1）

所有 JSON 成功响应均包在 `data` 下；失败响应均为 `ApiErrorResponse`。请求体为 `unknown`，由 Zod 严格校验，拒绝未声明字段。`GET` 没有请求体。

```ts
type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
};

type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'TODO_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string };
};
```

| 用途 | 方法与路径 | 请求 | 成功响应 | 失败响应 |
| --- | --- | --- | --- |
| 读取列表 | `GET /api/v1/todos` | 无 | `200 { data: { items: Todo[] } }`，按 `completed ASC, createdAt DESC` | `500 DATABASE_ERROR`（`无法读取待办列表，请稍后重试`） |
| 新增 | `POST /api/v1/todos` | `{ "title": string }` | `201 { data: { todo: Todo } }` | `400 VALIDATION_ERROR`（空白、超长、类型错误或多余字段）；`500 DATABASE_ERROR` |
| 编辑标题或状态 | `PATCH /api/v1/todos/:id` | 至少一个字段：`{ "title"?: string, "completed"?: boolean }` | `200 { data: { todo: Todo } }` | `400 VALIDATION_ERROR`；`404 TODO_NOT_FOUND`（`该待办已不存在，请重新加载`）；`500 DATABASE_ERROR` |
| 永久删除 | `DELETE /api/v1/todos/:id` | 无 | `204`，无响应体 | `404 TODO_NOT_FOUND`；`500 DATABASE_ERROR` |

`PATCH` 的 `title` 和 `completed` 可同时出现；编辑控件只发送 `title`，完成/恢复控件只发送 `completed`。路径参数必须为 UUID，不合法时返回 `400 VALIDATION_ERROR`。所有未预期异常被错误处理中间件记录为结构化服务端日志，并仅向客户端返回 `500 { error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' } }`。

## 前后端边界与状态流

1. 浏览器首次进入 `TodoPage` 时调用 `TodoApiClient.list()`；在请求完成前显示“正在加载待办…”，不能显示空状态。
2. API 层解析 HTTP 响应为共享契约；错误被转换为带 `code` 和中文 `message` 的 `ApiClientError`，组件不自行猜测服务端数据结构。
3. 页面仅在 POST/PATCH 成功后用服务端返回的 Todo 更新本地列表；失败时保留上一次服务器确认的列表，并显示 `role="alert"` 错误反馈。
4. 收到 `TODO_NOT_FOUND` 时显示“该待办已不存在，已重新加载列表”，随后自动调用 `list()`；删除失败则保留原条目。
5. 点击删除先显示受控确认对话框；确认前不发 HTTP 请求，取消后保持数据不变。所有按钮有可访问名称；编辑支持 Enter 保存、Escape 取消，表单可用键盘提交。

## 测试策略

- **共享契约单元测试：** 覆盖 trim 后空标题、201 个字符、非法 UUID、空 PATCH 与多余字段；每一项均断言 schema 拒绝并产生可预期中文消息。
- **后端 API 集成测试：** 使用独立 `TODO_TEST_DATABASE_URL` 指向测试 MySQL；每例迁移后清空 `todos`，经 Supertest 访问 Express 应用。覆盖每个端点的成功、校验失败、404、仓储抛错后的安全 500，以及列表排序。
- **前端组件测试：** 用 MSW 模拟 HTTP，验证加载、空状态、重新加载、成功反馈、编辑取消、失败时不乐观篡改、删除确认与辅助技术提示。
- **E2E：** Playwright 只访问真实 `apps/web` 和 `apps/api`，后端连接专用测试库。至少执行创建→完成→浏览器刷新→状态仍在→确认删除；每场景独立清理数据。
- **质量门禁：** `pnpm typecheck`、`pnpm test`、`pnpm test:api`、`pnpm test:e2e` 都须通过；在 CI 中按迁移、API、前端单测、E2E 的顺序执行。

## 实施任务

### Task 1：建立工作区、契约与本地配置

**文件：**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/todo.ts`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/test/todo.test.ts`
- Create: `.env.example`
- Create: `README.md`

**接口：**
- Produces: `TodoSchema`、`CreateTodoRequestSchema`、`UpdateTodoRequestSchema`、`TodoListResponseSchema`、`TodoResponseSchema`、`ApiErrorResponseSchema` 与 `API_V1_TODOS_PATH`。

- [ ] **Step 1：编写契约失败测试**

```ts
import { CreateTodoRequestSchema, UpdateTodoRequestSchema } from '../src/todo';

it.each(['   ', 'x'.repeat(201)])('拒绝无效标题 %s', (title) => {
  expect(CreateTodoRequestSchema.safeParse({ title }).success).toBe(false);
});

it('拒绝没有可更新字段的 PATCH 请求', () => {
  expect(UpdateTodoRequestSchema.safeParse({}).success).toBe(false);
});
```

- [ ] **Step 2：运行测试并确认其失败**

Run: `pnpm --filter @todo/contracts test -- todo.test.ts`

Expected: FAIL，原因是契约包或导出尚不存在。

- [ ] **Step 3：实现严格共享契约与工作区脚本**

```ts
export const TodoSchema = z.object({
  id: z.string().uuid(), title: z.string().min(1).max(200), completed: z.boolean(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export const CreateTodoRequestSchema = z.object({
  title: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(200)),
}).strict();
export const UpdateTodoRequestSchema = z.object({
  title: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(200)).optional(),
  completed: z.boolean().optional(),
}).strict().refine((value) => value.title !== undefined || value.completed !== undefined, {
  message: '至少提供一个待更新字段',
});
```

在根脚本中定义 `typecheck`、`test`、`test:api`、`test:e2e`；`.env.example` 仅包含占位的 `DATABASE_URL`、`TODO_TEST_DATABASE_URL`、`API_PORT` 和 `VITE_API_BASE_URL`，README 用中文说明复制为 `.env` 后填写本机凭据，且明确 `.env` 不提交。

- [ ] **Step 4：运行契约与类型检查**

Run: `pnpm install && pnpm --filter @todo/contracts test -- todo.test.ts && pnpm typecheck`

Expected: PASS，所有 TypeScript 项目启用 `strict: true` 且无 `any`。

- [ ] **Step 5：提交本任务**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages/contracts .env.example README.md
git commit -m "chore: 初始化 Todo 工作区和共享契约"
```

### Task 2：实现 MySQL 迁移与受控仓储层

**文件：**
- Create: `apps/api/package.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/database/pool.ts`
- Create: `apps/api/src/todos/todo.repository.ts`
- Create: `apps/api/migrations/001_create_todos.sql`
- Create: `apps/api/scripts/migrate.ts`
- Test: `apps/api/test/todos/todo.repository.test.ts`

**接口：**
- Consumes: `Todo` from `@todo/contracts`。
- Produces: `TodoRepository` with `list(): Promise<Todo[]>`, `create(title: string): Promise<Todo>`, `update(id: string, patch: UpdateTodoInput): Promise<Todo | null>`, and `remove(id: string): Promise<boolean>`.

- [ ] **Step 1：编写仓储排序与参数绑定测试**

```ts
it('按未完成优先、同状态创建时间倒序读取', async () => {
  await repository.create('较早未完成');
  await repository.create('较晚未完成');
  const first = (await repository.list())[0];
  expect(first.title).toBe('较晚未完成');
});

it('不存在的 ID 返回 null 或 false', async () => {
  await expect(repository.update(randomUUID(), { completed: true })).resolves.toBeNull();
  await expect(repository.remove(randomUUID())).resolves.toBe(false);
});
```

- [ ] **Step 2：运行测试并确认其失败**

Run: `pnpm --filter @todo/api test -- todo.repository.test.ts`

Expected: FAIL，原因是数据库池、迁移和 `TodoRepository` 尚不存在。

- [ ] **Step 3：实现迁移、连接池和参数化 SQL**

```sql
CREATE TABLE IF NOT EXISTS todos (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_todos_completed_created (completed ASC, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

仓储查询必须使用 `pool.execute(sql, values)`，列表 SQL 为 `ORDER BY completed ASC, created_at DESC`；创建在应用层使用 `randomUUID()`，行映射函数只把 `0 | 1` 转为 boolean 和数据库时间转为 ISO 字符串。配置读取 `unknown` 环境变量，缺少或不合法的数据库 URL 时以中文启动错误终止，不输出 URL 密码。

- [ ] **Step 4：运行迁移与仓储测试**

Run: `pnpm --filter @todo/api migrate:test && pnpm --filter @todo/api test -- todo.repository.test.ts`

Expected: PASS，测试库创建表后所有测试独立清空 `todos`。

- [ ] **Step 5：提交本任务**

```bash
git add apps/api/package.json apps/api/src apps/api/migrations apps/api/scripts apps/api/test/todos/todo.repository.test.ts
git commit -m "feat: 添加 MySQL Todo 仓储层"
```

### Task 3：实现 API 服务、路由与一致错误响应

**文件：**
- Create: `apps/api/src/todos/todo.service.ts`
- Create: `apps/api/src/todos/todo.routes.ts`
- Create: `apps/api/src/http/errors.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Test: `apps/api/test/todos/todo.api.test.ts`

**接口：**
- Consumes: Task 1 的 Zod schema，Task 2 的 `TodoRepository`。
- Produces: 可由 `createApp(repository)` 注入仓储的 Express `app`，以及四个 `/api/v1/todos` 端点。

- [ ] **Step 1：为每个端点编写 API 契约测试**

```ts
it('创建、更新并删除待办', async () => {
  const created = await request(app).post('/api/v1/todos').send({ title: '  写测试  ' }).expect(201);
  expect(created.body.data.todo.title).toBe('写测试');
  await request(app).patch(`/api/v1/todos/${created.body.data.todo.id}`).send({ completed: true }).expect(200);
  await request(app).delete(`/api/v1/todos/${created.body.data.todo.id}`).expect(204);
});

it('对不存在待办返回可处理的 404', async () => {
  const response = await request(app).delete(`/api/v1/todos/${randomUUID()}`).expect(404);
  expect(response.body).toEqual({ error: { code: 'TODO_NOT_FOUND', message: '该待办已不存在，请重新加载' } });
});
```

补充 GET 排序、POST/PATCH 空白与 201 字符、非法 UUID、空 PATCH、数据库故障不泄露 SQL 的测试。

- [ ] **Step 2：运行 API 测试并确认其失败**

Run: `pnpm --filter @todo/api test -- todo.api.test.ts`

Expected: FAIL，原因是 Express 应用和路由尚不存在。

- [ ] **Step 3：最小实现服务与路由**

服务层只做业务编排：创建调用 `repository.create`，更新的 `null` 和删除的 `false` 转为 `TodoNotFoundError`。路由使用 `safeParse(req.body as unknown)` 和 `safeParse(req.params.id)`，成功严格按契约返回；不得在路由中写 SQL。错误中间件将 Zod/业务/数据库错误映射到上述状态码与中文信息，日志只记录错误类别和请求 ID。

```ts
router.patch('/:id', async (req, res, next) => {
  const id = UuidSchema.safeParse(req.params.id);
  const body = UpdateTodoRequestSchema.safeParse(req.body as unknown);
  if (!id.success || !body.success) return next(new ValidationError('请求参数不合法'));
  const todo = await service.update(id.data, body.data);
  return res.status(200).json({ data: { todo } });
});
```

- [ ] **Step 4：运行 API 测试和类型检查**

Run: `pnpm test:api && pnpm typecheck`

Expected: PASS，所有端点均有正常、校验、未找到或主要故障覆盖。

- [ ] **Step 5：提交本任务**

```bash
git add apps/api/src apps/api/test/todos/todo.api.test.ts
git commit -m "feat: 提供 Todo v1 HTTP API"
```

### Task 4：建立 React 应用与类型安全 API 客户端

**文件：**
- Create: `apps/web/package.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api/todoApiClient.ts`
- Create: `apps/web/src/api/apiClientError.ts`
- Create: `apps/web/src/test/server.ts`
- Test: `apps/web/src/api/todoApiClient.test.ts`

**接口：**
- Consumes: Task 1 的请求和响应 schema。
- Produces: `TodoApiClient` with `list`, `create`, `update`, `remove`，失败时抛出 `ApiClientError { code, message, status }`。

- [ ] **Step 1：编写客户端解析与错误映射测试**

```ts
it('将服务端确认的 Todo 返回给调用方', async () => {
  server.use(http.post('/api/v1/todos', () => HttpResponse.json({ data: { todo } }, { status: 201 })));
  await expect(client.create({ title: '写文档' })).resolves.toEqual(todo);
});

it('保留可识别的服务端错误码', async () => {
  server.use(http.get('/api/v1/todos', () => HttpResponse.json({ error: { code: 'DATABASE_ERROR', message: '无法读取待办列表，请稍后重试' } }, { status: 500 })));
  await expect(client.list()).rejects.toMatchObject({ code: 'DATABASE_ERROR' });
});
```

- [ ] **Step 2：运行测试并确认其失败**

Run: `pnpm --filter @todo/web test -- todoApiClient.test.ts`

Expected: FAIL，原因是 Vite 应用和客户端尚不存在。

- [ ] **Step 3：实现仅依赖 HTTP 的客户端**

`fetch` 使用 `VITE_API_BASE_URL`（开发默认空字符串），设置 `Content-Type: application/json`，204 不尝试解析 JSON；非成功响应必须先以 `unknown` 解析共享错误 schema，再抛出中文 `ApiClientError`。成功响应同样经 schema 校验，遇到畸形响应显示“服务响应格式异常，请稍后重试”。不使用 localStorage、假数据或数据库 SDK。

- [ ] **Step 4：运行前端 API 测试和类型检查**

Run: `pnpm --filter @todo/web test -- todoApiClient.test.ts && pnpm typecheck`

Expected: PASS，所有网络数据先经运行时 schema 校验。

- [ ] **Step 5：提交本任务**

```bash
git add apps/web/package.json apps/web/src
git commit -m "feat: 添加 React Todo API 客户端"
```

### Task 5：实现可访问的 Todo 界面与失败安全状态

**文件：**
- Create: `apps/web/src/features/todos/TodoPage.tsx`
- Create: `apps/web/src/features/todos/TodoForm.tsx`
- Create: `apps/web/src/features/todos/TodoList.tsx`
- Create: `apps/web/src/features/todos/TodoItem.tsx`
- Create: `apps/web/src/features/todos/DeleteConfirmDialog.tsx`
- Create: `apps/web/src/features/todos/todoValidation.ts`
- Create: `apps/web/src/styles.css`
- Test: `apps/web/src/features/todos/TodoPage.test.tsx`

**接口：**
- Consumes: Task 4 的 `TodoApiClient`。
- Produces: `TodoPage`，处理 `{ loading, items, error, notice }` 状态，且每次写入只在 API 成功后变更 `items`。

- [ ] **Step 1：编写用户可见状态测试**

```tsx
it('加载时不显示空状态，失败时提供重新加载', async () => {
  render(<TodoPage api={api} />);
  expect(screen.getByText('正在加载待办…')).toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: '重新加载' }));
});

it('写入失败后保留服务器确认的条目', async () => {
  api.update.mockRejectedValue(new ApiClientError('DATABASE_ERROR', '保存失败，请稍后重试', 500));
  render(<TodoPage api={apiWithOneTodo} />);
  await userEvent.click(await screen.findByRole('button', { name: '标记“缴费”为已完成' }));
  expect(screen.getByText('缴费')).not.toHaveClass('completed');
  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试');
});
```

补充新增 trim 校验与清空、200 字符限制、编辑保存/取消、完成/恢复排序、删除确认/取消/失败、`TODO_NOT_FOUND` 自动重载和键盘 Enter/Escape 测试。

- [ ] **Step 2：运行组件测试并确认其失败**

Run: `pnpm --filter @todo/web test -- TodoPage.test.tsx`

Expected: FAIL，原因是页面组件和控件尚不存在。

- [ ] **Step 3：实现界面和交互**

表单和行内编辑共用 `normalizeTitle(value: string)`，在提交前显示“请输入待办标题”或“标题不能超过 200 个字符”。每个操作按钮具备中文 `aria-label`；完成状态使用文本和样式双重表达（例如“已完成”与删除线），而非仅颜色。错误、成功通知使用 `role="alert"` / `role="status"`；CSS 以单列、可换行布局和 `max-width` 实现移动端，无水平滚动。删除对话框使用 `role="dialog"`、明确标题、确认和取消按钮，并在关闭时把焦点还给触发按钮。

- [ ] **Step 4：运行全部前端测试、构建与类型检查**

Run: `pnpm --filter @todo/web test && pnpm --filter @todo/web build && pnpm typecheck`

Expected: PASS，构建不含 TypeScript 错误，所有验收状态均有组件测试。

- [ ] **Step 5：提交本任务**

```bash
git add apps/web/src
git commit -m "feat: 实现可访问的 Todo 单页界面"
```

### Task 6：加入真实链路 E2E、CI 与交付验证

**文件：**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/todos.spec.ts`
- Create: `scripts/reset-test-database.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**接口：**
- Consumes: 已运行的 React、API、测试 MySQL 和 `TODO_TEST_DATABASE_URL`。
- Produces: 可重复执行的核心用户流程 E2E 与 CI 质量门禁。

- [ ] **Step 1：编写真实后端 E2E 场景**

```ts
test('新增、完成、刷新后保持状态并删除待办', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('新的待办标题').fill('准备周报');
  await page.getByRole('button', { name: '新增待办' }).click();
  await expect(page.getByText('准备周报')).toBeVisible();
  await page.getByRole('button', { name: '标记“准备周报”为已完成' }).click();
  await page.reload();
  await expect(page.getByText('准备周报')).toHaveClass(/completed/);
  await page.getByRole('button', { name: '删除“准备周报”' }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByText('还没有待办，新增第一条吧。')).toBeVisible();
});
```

- [ ] **Step 2：运行 E2E 并确认其在配置前失败**

Run: `pnpm test:e2e`

Expected: FAIL，原因是 Playwright、测试数据库重置或服务启动编排尚未配置。

- [ ] **Step 3：实现隔离测试编排与 CI**

重置脚本仅连接 `TODO_TEST_DATABASE_URL`，先验证库名以 `_test` 结尾再执行 `DELETE FROM todos`；Playwright `webServer` 并行启动 API 与 Vite，二者读测试环境变量。CI 使用 MySQL 8 service，执行 `pnpm install --frozen-lockfile`、迁移、`pnpm typecheck`、前后端测试和 E2E；不打印环境变量值。README 增加中文的前置条件、初始化数据库、开发启动、测试命令和故障排查说明。

- [ ] **Step 4：执行完整质量门禁**

Run: `pnpm typecheck && pnpm test && pnpm test:api && pnpm test:e2e`

Expected: PASS；新增、刷新持久化、删除及 API 关键失败场景均经自动化验证。

- [ ] **Step 5：提交本任务**

```bash
git add e2e scripts .github/workflows/ci.yml README.md
git commit -m "test: 覆盖 Todo 真实端到端流程"
```

## 计划自检

- 规格中的新增、读取（排序/加载/空/失败）、完成/恢复、编辑、确认删除/取消/失败，分别由 Task 3、Task 5 与 Task 6 覆盖。
- MySQL 持久化、受控访问、参数化查询和刷新后的验证，分别由 Task 2、Task 3 与 Task 6 覆盖。
- 版本化 API 的方法、路径、请求、成功/错误响应和状态码已在“API 契约（v1）”定义，并由 Task 1 与 Task 3 共享和实现。
- 前后端职责、失败时不伪造成功、无 `any`、中文内容、键盘与辅助技术支持、环境变量保护，已在全局约束与相应任务中明确。
- 已检查计划文本：任务中没有未定义的接口占位；使用的仓储、服务和客户端接口都在其生产任务中定义。
