# Todo 搜索与筛选实现计划

> **供自动化执行代理使用：** 实现本计划时必须逐任务执行，并以复选框记录进度；建议使用 `subagent-driven-development` 或 `executing-plans`，在每个任务结束时完成评审。

**目标：** 在既有单用户 Todo List 上增加由 MySQL 驱动的标题关键词搜索、完成状态筛选、组合查询及加载、空结果、失败重试和过期响应保护。

**架构：** 保持现有 pnpm 工作区边界：`apps/web` 的 React 页面只维护控件和服务器查询状态，`apps/api` 的 Node.js 服务负责查询参数校验与业务编排，`TodoRepository` 负责唯一的 MySQL 访问，`packages/contracts` 作为前后端共享的查询类型、schema 和错误码单一来源。查询继续使用 `/api/v1/todos`，通过可选 query string 扩展既有 GET 语义；新增、编辑、完成/恢复和删除接口保持不变，但成功后由前端按当前查询条件重新读取服务器结果。

**技术栈：** Node.js 20 LTS、TypeScript、pnpm、React 18、Vite、Express、MySQL 8、`mysql2/promise`、Zod、Vitest、React Testing Library、Supertest、Playwright。

## 全局约束

- 前端必须继续使用 React 和 TypeScript；后端必须继续使用 Node.js 和 TypeScript；Todo 数据必须从 MySQL 读取。
- 搜索字段仅为 Todo 标题；非空关键词使用标题包含匹配，匹配英文字母时不区分大小写。
- 关键词必须先去除首尾空白；去除后为空时不设置关键词条件；未提供状态时使用 `all`。
- 状态筛选只允许 `all`、`active`、`completed`；其他值必须返回一致的客户端可识别错误，不得静默当作 `all`。
- 关键词与状态条件使用逻辑 AND；查询结果固定按未完成优先、同状态创建时间从新到旧排序；本迭代不分页、不限制结果数量。
- React 不得连接 MySQL 或把本地过滤结果作为唯一来源；Node.js 必须通过数据访问层访问 MySQL，并使用参数化查询或 ORM 参数绑定。
- 前后端通过版本明确的 HTTP API 和共享 TypeScript/Zod 契约通信；不得使用 `any`、无约束类型断言或忽略 TypeScript 错误。
- 搜索结果为空、服务器读取失败和查询加载中必须是三个独立的界面状态；所有相关文本、错误说明、文档和新增注释使用中文。
- 搜索框、状态控件、清除操作、加载/错误/空结果反馈和重试操作必须可键盘使用，并具有可访问名称或辅助技术可感知的状态。
- TypeScript 类型检查、API 测试和 E2E 测试全部通过前不得标记功能完成；不得提交环境变量、数据库凭据或其他敏感信息。

## 文件与职责

| 路径 | 职责 |
| --- | --- |
| `packages/contracts/src/todo.ts` | 新增查询状态类型、查询参数 schema、查询列表响应/错误契约；保持既有写入契约兼容。 |
| `packages/contracts/test/todo.test.ts` | 验证查询参数的 trim、默认值、状态枚举和非法输入。 |
| `apps/api/src/todos/todo.repository.ts` | 将结构化查询条件转换为参数化 SQL；保持排序和结果行映射。 |
| `apps/api/src/todos/todo.service.ts` | 接收已校验的查询条件并委托仓储，不在服务中做本地过滤。 |
| `apps/api/src/todos/todo.routes.ts`、`apps/api/src/http/errors.ts` | 解析 URL query、返回查询结果，并把非法状态映射为稳定的 400 错误。 |
| `apps/api/test/todos/todo.repository.test.ts` | 验证无条件、关键词、状态和组合查询真正由数据库结果筛选。 |
| `apps/api/test/todos/todo.api.test.ts` | 验证 HTTP 参数、响应、错误状态和数据库失败的安全表现。 |
| `apps/web/src/api/todoApiClient.ts`、`apps/web/src/api/apiClientError.ts` | 序列化查询参数、解析共享响应和传播可处理错误。 |
| `apps/web/src/features/todos/TodoPage.tsx`、`styles.css` | 查询控件、查询状态机、竞态保护、清除/重试和当前结果下的既有操作。 |
| `apps/web/src/api/todoApiClient.test.ts`、`apps/web/src/features/todos/TodoPage.test.tsx` | 客户端契约与页面交互、加载、错误、空结果和过期响应测试。 |
| `e2e/todos.spec.ts` | 使用真实前后端和 MySQL 验证关键词、状态、组合条件、清除及结果更新。 |

## 数据模型与查询设计

不修改 `todos` 表的业务字段或写入规则。现有字段继续作为查询来源：`id CHAR(36)`、`title VARCHAR(200)`、`completed TINYINT(1)`、`created_at DATETIME(3)`、`updated_at DATETIME(3)`。现有 `idx_todos_completed_created (completed ASC, created_at DESC)` 保留，用于固定排序；本迭代不新增搜索索引，也不改变迁移中的列定义。

仓储接受结构化输入，而不是原始 URL 字符串：

```ts
export type TodoSearchStatus = 'all' | 'active' | 'completed';
export type TodoSearchQuery = { keyword?: string; status: TodoSearchStatus };
export interface TodoRepository {
  list(query: TodoSearchQuery): Promise<Todo[]>;
  // 既有 create/update/remove 接口保持不变
}
```

`keyword` 非空时生成 `LOWER(title) LIKE LOWER(?)`，绑定值为 `%${keyword}%`；不得把关键词拼进 SQL。`status=active` 绑定 `completed = 0`，`status=completed` 绑定 `completed = 1`，`all` 不追加状态条件。SQL 的动态部分只能来自后端固定分支，最终始终追加 `ORDER BY completed ASC, created_at DESC`。MySQL 数据库的大小写规则可能因 collation 配置不同，因此用 `LOWER` 明确保证英文字母不区分大小写；中文按 MySQL 的字符匹配规则进行包含查询。

## API 契约（v1）

### 查询列表

`GET /api/v1/todos`

Query 参数：

```text
q=<string>       可选；服务端 trim，trim 后为空等同未提供
status=all       可选；默认 all，可选 active 或 completed
```

成功：`200 { "data": { "items": Todo[] } }`，沿用既有 Todo DTO 和排序。

失败：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "状态筛选值不支持，请使用 all、active 或 completed"
  }
}
```

非法 `status` 返回 `400`；数据库或未预期读取故障分别返回既有安全的 `500 DATABASE_ERROR` 或 `500 INTERNAL_ERROR`，不得包含 SQL、凭据或堆栈。既有 POST/PATCH/DELETE 契约、路径、状态码和语义不变。

## 前后端边界与状态流

1. React 将输入框原始文本保存在 `keywordInput`，状态控件保存 `TodoSearchStatus`；请求前可在客户端 trim 以更新 URL 参数，但后端仍是最终校验和查询来源。
2. `TodoApiClient.list({ keyword, status })` 只发送 `q`（trim 后非空时）和 `status`，使用共享 `TodoListResponseSchema` 解析响应；不在浏览器端对完整结果二次过滤。
3. 页面为每次查询生成递增 `requestId` 或使用 `AbortController`；响应提交前确认仍对应最新查询条件。旧请求即使后返回，也不得覆盖最新结果、loading、empty 或 error 状态。
4. 新条件开始查询时保留控件值，进入 loading；只有当前请求成功后才替换列表。成功空数组显示“没有找到匹配待办”（未设置任何条件且全表为空时沿用既有首条待办提示）。
5. 查询失败显示中文 `role="alert"` 和“重新加载”操作，保留关键词及状态；失败时不清空上一次服务器确认的列表，且不显示空结果。
6. 清除按钮清空关键词并将状态恢复为 `all`（分别清除时只改变对应条件），立即以新条件查询。完成、恢复、编辑或删除成功后重新调用当前查询；因此状态改变后不再匹配的项目会消失，并重新应用排序。

## 测试策略与交付门禁

- **共享契约：** 测试 `q` 缺省、首尾空白、全空白、`status` 缺省和三个合法值；拒绝未知状态、数组/对象类型和未声明 query 字段（若实现使用严格对象 schema）。
- **仓储/API：** 在独立测试 MySQL 中准备混合标题和状态，覆盖无条件列表、`采购`、`review`/`REVIEW`、trim、active、completed、all、组合 AND、无结果、非法状态 400、排序以及数据库异常不泄露内部信息。测试应通过 mock Pool 或测试数据库断言绑定参数，不接受拼接输入的实现。
- **React 单测：** 覆盖初始 loading、关键词输入、状态切换、组合结果、清除、中文无结果、失败重试、失败不误报为空，以及两个请求反序返回时仅最后一次结果可见。为竞态测试使用可控 Promise，明确先解决旧请求再解决新请求。
- **E2E：** 通过真实 API 和 MySQL 清理独立数据，至少验证输入关键词只显示匹配项、切换 active/completed、组合条件得到交集、清除条件恢复全部列表，以及在筛选结果中完成项目后其按当前条件移除/重新加载。另覆盖控件可用可访问名称定位。
- **门禁命令：** `pnpm typecheck`、`pnpm --filter @todo/contracts test`、`pnpm test:api`、`pnpm --filter @todo/web test`、`pnpm test:e2e`；全部通过后才完成。

---

## 实施任务

### Task 1：扩展共享搜索契约

**文件：**
- Modify: `packages/contracts/src/todo.ts`
- Test: `packages/contracts/test/todo.test.ts`

**接口：**
- Consumes: 既有 `TodoSchema`、`TodoListResponseSchema`。
- Produces: `TodoSearchStatusSchema`、`TodoSearchQuerySchema`、`TodoSearchStatus`、`TodoSearchQuery`。

- [ ] **Step 1：先写失败测试**

```ts
it('将 q 首尾空白归一化并默认 status=all', () => {
  expect(TodoSearchQuerySchema.parse({ q: '  Review  ' })).toEqual({ keyword: 'Review', status: 'all' });
  expect(TodoSearchQuerySchema.parse({})).toEqual({ status: 'all' });
});

it.each(['pending', '', 'ACTIVE'])('拒绝非法状态 %s', (status) => {
  expect(TodoSearchQuerySchema.safeParse({ status }).success).toBe(false);
});
```

- [ ] **Step 2：运行测试确认失败**

Run: `pnpm --filter @todo/contracts test -- todo.test.ts`

Expected: FAIL，因为查询 schema 尚未导出。

- [ ] **Step 3：实现契约**

```ts
export const TodoSearchStatusSchema = z.enum(['all', 'active', 'completed']);
export const TodoSearchQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: TodoSearchStatusSchema.default('all'),
}).strict();
export type TodoSearchStatus = z.infer<typeof TodoSearchStatusSchema>;
export type TodoSearchQuery = { keyword?: string; status: TodoSearchStatus };
```

路由层把 URL 的 `q` 映射为 schema 的 `q`，解析成功后转换为 `TodoSearchQuery`；全空白输入必须得到未设置关键词的结果，而不是校验错误。若 Zod 版本不允许 `trim().min(1).optional()` 对空白值达到该语义，使用 `preprocess` 将空字符串转换为 `undefined`，并为该行为保留测试。

- [ ] **Step 4：运行契约测试与类型检查**

Run: `pnpm --filter @todo/contracts test -- todo.test.ts && pnpm typecheck`

Expected: PASS，既有 Todo 写入契约测试不回归。

- [ ] **Step 5：提交**

```bash
git add packages/contracts/src/todo.ts packages/contracts/test/todo.test.ts
git commit -m "feat: 增加 Todo 搜索查询契约"
```

### Task 2：实现 MySQL 参数化查询

**文件：**
- Modify: `apps/api/src/todos/todo.repository.ts`
- Test: `apps/api/test/todos/todo.repository.test.ts`

**接口：**
- Consumes: `TodoSearchQuery`。
- Produces: `list(query: TodoSearchQuery): Promise<Todo[]>`。

- [ ] **Step 1：编写数据库查询失败测试**

```ts
it('按关键词、状态和固定排序返回交集', async () => {
  const completed = await repository.create('Review API');
  await repository.create('Review 文档');
  await repository.update(completed.id, { completed: true });
  const items = await repository.list({ keyword: ' review ', status: 'active' });
  expect(items.map((item) => item.title)).toEqual(['Review 文档']);
});
```

同时准备仅有已完成项目的 `active` 查询和不存在关键词的查询，断言返回 `[]` 而不是异常。

- [ ] **Step 2：运行测试确认失败**

Run: `pnpm --filter @todo/api test -- todo.repository.test.ts`

Expected: FAIL，因为当前 `list()` 无参数且不会应用筛选。

- [ ] **Step 3：实现参数化 SQL**

将签名改为 `list(query: TodoSearchQuery)`，在固定分支中构建 `conditions: string[]` 与 `values: (string | number)[]`：关键词绑定 `%${query.keyword}%`，状态绑定 `0/1`，SQL 形态只能由后端常量选择；调用 `pool.execute(sql, values)`。永远保留 `ORDER BY completed ASC, created_at DESC`，不得修改迁移或写入方法。

- [ ] **Step 4：运行仓储测试**

Run: `pnpm --filter @todo/api test -- todo.repository.test.ts && pnpm typecheck`

Expected: PASS，包含无条件、大小写、trim、三种状态、组合和无结果测试，且不存在 SQL 注入拼接。

- [ ] **Step 5：提交**

```bash
git add apps/api/src/todos/todo.repository.ts apps/api/test/todos/todo.repository.test.ts
git commit -m "feat: 支持 Todo 搜索筛选的参数化查询"
```

### Task 3：接入查询 API 与安全错误

**文件：**
- Modify: `apps/api/src/todos/todo.service.ts`
- Modify: `apps/api/src/todos/todo.routes.ts`
- Modify: `apps/api/src/http/errors.ts`
- Test: `apps/api/test/todos/todo.api.test.ts`

**接口：**
- Consumes: `TodoSearchQuerySchema` 与 `TodoRepository.list(query)`。
- Produces: `GET /api/v1/todos?q=<keyword>&status=<status>`。

- [ ] **Step 1：写 API 契约测试**

```ts
it('GET 查询组合条件并保留既有响应结构', async () => {
  const response = await request(app)
    .get('/api/v1/todos?q=%20Review%20&status=completed')
    .expect(200);
  expect(response.body).toEqual({ data: { items: [{ id: expect.any(String), title: 'Review API', completed: true, createdAt: expect.any(String), updatedAt: expect.any(String) }] } });
});

it('拒绝不支持的状态而不是静默返回全部', async () => {
  const response = await request(app).get('/api/v1/todos?status=pending').expect(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
});
```

补充无参数、全空白 q、`all`、无结果和仓储抛错的测试；故障响应不得包含 SQL 或堆栈。

- [ ] **Step 2：运行 API 测试确认失败**

Run: `pnpm test:api -- todo.api.test.ts`

Expected: FAIL，因为路由尚未读取 query，服务也未传递查询对象。

- [ ] **Step 3：实现解析和服务透传**

从 `req.query` 中按 `unknown` 读取 `q` 和 `status`，拒绝数组值；用 `TodoSearchQuerySchema.safeParse` 校验，成功后映射为 `{ keyword: parsed.q, status: parsed.status }`，失败抛出现有 `VALIDATION_ERROR`。`TodoService.list(query)` 只委托 `repository.list(query)`。保持 GET 成功结构和所有 POST/PATCH/DELETE 行为不变。

- [ ] **Step 4：运行 API、契约和类型检查**

Run: `pnpm test:api && pnpm --filter @todo/contracts test && pnpm typecheck`

Expected: PASS，非法状态为 400，空结果为 200 空数组，数据库故障为安全的 500。

- [ ] **Step 5：提交**

```bash
git add apps/api/src/todos/todo.service.ts apps/api/src/todos/todo.routes.ts apps/api/src/http/errors.ts apps/api/test/todos/todo.api.test.ts
git commit -m "feat: 提供 Todo 搜索筛选 API"
```

### Task 4：扩展类型安全的前端 API 客户端

**文件：**
- Modify: `apps/web/src/api/todoApiClient.ts`
- Test: `apps/web/src/api/todoApiClient.test.ts`

**接口：**
- Consumes: `TodoSearchQuery`、`TodoListResponseSchema`、`ApiErrorResponseSchema`。
- Produces: `todoApiClient.list(query: TodoSearchQuery): Promise<Todo[]>`。

- [ ] **Step 1：编写客户端序列化测试**

```ts
it('只发送非空 q 和当前 status', async () => {
  server.use(http.get('/api/v1/todos', ({ request }) => {
    const url = new URL(request.url);
    expect(url.searchParams.get('q')).toBe('Review');
    expect(url.searchParams.get('status')).toBe('active');
    return HttpResponse.json({ data: { items: [] } });
  }));
  await expect(todoApiClient.list({ keyword: '  Review  ', status: 'active' })).resolves.toEqual([]);
});
```

另测 `all`、空关键词不发送 `q`、400 错误转换为 `ApiClientError`。

- [ ] **Step 2：运行测试确认失败**

Run: `pnpm --filter @todo/web test -- todoApiClient.test.ts`

Expected: FAIL，因为客户端当前 `list()` 不接受查询对象。

- [ ] **Step 3：实现查询参数和响应解析**

在客户端将关键词 trim 后用 `URLSearchParams` 编码；`status` 始终发送，`keyword` 为空时不发送 `q`。保留共享 schema 解析和现有错误映射，不增加本地过滤逻辑。

- [ ] **Step 4：运行客户端测试和类型检查**

Run: `pnpm --filter @todo/web test -- todoApiClient.test.ts && pnpm typecheck`

Expected: PASS，中文 API 错误可由页面读取，所有写入客户端调用仍兼容。

- [ ] **Step 5：提交**

```bash
git add apps/web/src/api/todoApiClient.ts apps/web/src/api/todoApiClient.test.ts
git commit -m "feat: 支持前端 Todo 查询参数"
```

### Task 5：实现 React 搜索筛选交互与竞态保护

**文件：**
- Modify: `apps/web/src/features/todos/TodoPage.tsx`
- Modify: `apps/web/src/features/todos/styles.css`
- Test: `apps/web/src/features/todos/TodoPage.test.tsx`

**接口：**
- Consumes: `todoApiClient.list({ keyword, status })` 与既有 Todo 写入方法。
- Produces: 可键盘操作的搜索框、`全部/未完成/已完成` 控件、清除和重试操作，以及只提交最新查询的页面状态。

- [ ] **Step 1：先写页面失败测试**

```tsx
it('组合条件只显示交集并可清除条件', async () => {
  render(<TodoPage />);
  await user.type(screen.getByRole('searchbox', { name: '搜索待办标题' }), '采购');
  await user.selectOptions(screen.getByRole('combobox', { name: '完成状态筛选' }), 'active');
  expect(await screen.findByText('采购未完成')).toBeVisible();
  expect(screen.queryByText('采购已完成')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '清除搜索条件' }));
  expect(await screen.findByText('采购已完成')).toBeVisible();
});
```

补充测试 loading 不显示空状态、中文“没有找到匹配待办”、错误重试、保留条件、写操作后重新查询，以及两个可控 Promise 反序返回时旧结果不覆盖新结果。

- [ ] **Step 2：运行页面测试确认失败**

Run: `pnpm --filter @todo/web test -- TodoPage.test.tsx`

Expected: FAIL，因为当前页面只有全部列表，没有查询控件或竞态保护。

- [ ] **Step 3：实现状态机和控件**

增加 `keywordInput`、`status`、`queryState` 和递增 `requestIdRef`；`load(query)` 在开始时设置 loading 并清除查询错误，在响应提交前检查请求编号。关键词采用提交或防抖后的查询（计划采用 300ms 防抖，按规格“提交或等待搜索生效”满足任一），状态选择立即查询；清除按钮恢复相应条件并查询。渲染顺序必须是 loading → error（不显示空提示）→ empty → list；错误重试使用当前条件。

使用 `<label>`、`role="searchbox"`、`<select>`、`aria-live="polite"` 的加载/结果提示和 `role="alert"` 错误。写操作成功后调用当前查询的 `load`，不直接把未筛选的本地数组当作最终结果；保留既有完成、恢复、编辑、删除语义。

- [ ] **Step 4：运行页面测试与类型检查**

Run: `pnpm --filter @todo/web test -- TodoPage.test.tsx && pnpm typecheck`

Expected: PASS，快速连续输入最终只呈现最后条件的服务器结果，键盘和可访问名称测试通过。

- [ ] **Step 5：提交**

```bash
git add apps/web/src/features/todos/TodoPage.tsx apps/web/src/features/todos/styles.css apps/web/src/features/todos/TodoPage.test.tsx
git commit -m "feat: 增加 Todo 搜索筛选界面"
```

### Task 6：补充真实链路 E2E 与交付验证

**文件：**
- Modify: `e2e/todos.spec.ts`
- Modify: `README.md`（仅在启动或测试命令需要更新时）

**接口：**
- Consumes: 已完成的 v1 查询 API 和 React 控件。
- Produces: 规格要求的真实浏览器验收覆盖和最终质量证据。

- [ ] **Step 1：编写 E2E 场景**

在每个场景前清理测试库并创建至少四条混合数据，使用可访问名称验证：关键词 `采购` 只显示匹配项、切换“未完成”和“已完成”、组合条件只显示交集、清除条件恢复全部列表；再在筛选结果中完成一条，使其从 `active` 结果移除并验证重新查询后的排序。

- [ ] **Step 2：运行 E2E 确认失败或暴露集成问题**

Run: `pnpm test:e2e`

Expected: 新增场景在功能未完整接线时失败；若环境缺少测试数据库，输出中文配置错误并补充 README，不写入凭据。

- [ ] **Step 3：修复仅属于本功能的集成问题**

只调整查询契约、API、页面状态和测试启动配置；不得通过浏览器本地过滤绕过后端查询，也不得改变既有写入 API 或数据模型。

- [ ] **Step 4：执行完整交付门禁**

Run: `pnpm typecheck && pnpm --filter @todo/contracts test && pnpm test:api && pnpm --filter @todo/web test && pnpm test:e2e`

Expected: 全部命令退出码为 0；查询 API、前端交互和真实 E2E 均通过。

- [ ] **Step 5：提交**

```bash
git add e2e/todos.spec.ts README.md
git commit -m "test: 覆盖 Todo 搜索筛选端到端流程"
```

## 规格覆盖自检

- 标题包含搜索、英文字母大小写不敏感、首尾空白、空关键词：Task 1–5；API 数据库查询来源：Task 2–3。
- `all`、`active`、`completed`、非法状态、组合 AND、无结果与固定排序：Task 1–3、Task 6。
- 加载、失败、重试、条件保留和快速连续查询的最新响应保护：Task 5。
- 当前筛选结果中的完成、恢复、编辑、删除及操作后重新计算：Task 5、Task 6。
- React/Node.js/TypeScript/MySQL 边界、参数化查询、共享类型、无敏感信息：全局约束、文件职责和 Task 2–4。
- API 自动化、E2E、类型检查和完成门禁：测试策略、Task 3、Task 5、Task 6。

## 计划自检

- 已确认没有 `.codegraph/`，无需使用 CodeGraph。
- 已对照 `specs/002-todo-search/spec.md` 的范围、业务规则、非功能要求和成功标准；没有加入分页、用户、标签、高亮或其他越界能力。
- 已明确现有 `todos` 数据模型不变，新增能力仅扩展 GET 查询参数；所有 SQL 用户输入均通过绑定参数传入。
- 已检查计划中没有未定义的占位要求；每个实现任务包含文件、接口、测试、命令和预期结果。
