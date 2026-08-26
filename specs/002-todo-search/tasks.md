# Todo 搜索与筛选实施任务

> 按依赖顺序执行。所有新增规格、任务说明、错误说明和代码注释使用中文；TypeScript 类型检查、API 测试和 E2E 测试全部通过后，才可将本变更标记为完成。

## 当前实施状态

- [x] Task 1：共享搜索契约
- [x] Task 2：MySQL 参数化筛选逻辑
- [x] Task 3：搜索筛选 API 与安全错误
- [x] Task 4：前端 API 客户端
- [x] Task 5：React 搜索筛选交互与竞态保护
- [ ] Task 6：真实 E2E 与最终交付验证（E2E 启动被工作区已有的 3001 端口进程占用阻塞，见验证记录）

> 验证记录：`pnpm typecheck`、`pnpm --filter @todo/contracts test`、`pnpm test:api`、`pnpm --filter @todo/web test` 均通过；`pnpm test:e2e` 尚未进入用例，Playwright `webServer` 检查因 `127.0.0.1:3001` 已被 PID 62969 的既有进程占用而超时/启动冲突。因此本变更暂不标记为全部完成。

## 1. 搜索接口

依赖：无

- [ ] 在 `packages/contracts/src/todo.ts` 新增 `TodoSearchStatusSchema`、`TodoSearchQuerySchema`、`TodoSearchStatus` 和 `TodoSearchQuery`。
  - 支持 `all`、`active`、`completed`，缺省状态为 `all`。
  - 对 `q` 做首尾空白裁剪；空字符串或全空白按未设置关键词处理。
  - 保持既有 Todo 写入契约兼容，不使用 `any` 或无约束类型断言。
- [ ] 将 `GET /api/v1/todos` 扩展为支持 `q` 和 `status` 查询参数，成功响应保持 `{ data: { items } }` 结构。
  - 按 `unknown` 读取 query 参数并拒绝数组值。
  - 非法状态返回 `400 VALIDATION_ERROR`，不得静默当作 `all`。
  - 数据库或未知故障返回安全的 `500 DATABASE_ERROR` 或 `500 INTERNAL_ERROR`，不得泄露 SQL、凭据或堆栈。
- [ ] 让 `TodoService.list(query)` 接收共享查询对象并委托数据访问层；既有 POST/PATCH/DELETE 语义不变。
- [ ] 完成契约和基础接口类型检查：`pnpm --filter @todo/contracts test`、`pnpm typecheck`。

## 2. 筛选逻辑

依赖：1. 搜索接口中的共享查询契约

- [ ] 修改 `apps/api/src/todos/todo.repository.ts`，让 `list(query: TodoSearchQuery)` 使用参数化 MySQL 查询。
  - 非空关键词使用 `LOWER(title) LIKE LOWER(?)`，绑定值为 `%${keyword}%`。
  - `active` 绑定 `completed = 0`，`completed` 绑定 `completed = 1`，`all` 不增加状态条件。
  - 关键词和状态条件使用逻辑 AND；动态 SQL 只能来自后端固定分支，禁止拼接用户输入。
  - 始终使用 `ORDER BY completed ASC, created_at DESC`，不分页、不限制结果数量。
- [ ] 保持 Todo 行映射和既有写入方法不变；确保无条件、空关键词、无结果和组合条件均返回正常列表或空数组。
- [ ] 检查 `TodoRepository`、服务和路由之间的类型传递，避免前端本地过滤成为数据来源。
- [ ] 运行仓储测试和类型检查：`pnpm --filter @todo/api test -- todo.repository.test.ts && pnpm typecheck`。

## 3. React 页面

依赖：1. 搜索接口、2. 筛选逻辑

- [ ] 修改 `apps/web/src/api/todoApiClient.ts` 和相关错误处理，提供 `list({ keyword, status })`。
  - 使用 `URLSearchParams` 发送 trim 后的非空 `q` 和当前 `status`。
  - 解析共享响应 schema，并将可处理的 API 错误转换为页面可用的 `ApiClientError`。
  - 不在浏览器端对完整列表进行二次过滤。
- [ ] 修改 `apps/web/src/features/todos/TodoPage.tsx` 和 `styles.css`，增加中文搜索和筛选交互。
  - 提供可访问的搜索框、`全部/未完成/已完成` 控件、分别清除或清除全部条件的操作。
  - 关键词支持提交或约 300ms 防抖查询；状态切换立即查询。
  - 维护 `keywordInput`、状态和查询状态；展示加载、错误/重新加载、无结果和列表四种互斥呈现，加载时不得误显示空状态。
  - 错误使用 `role="alert"`，加载和结果反馈可被辅助技术感知，并保留当前条件和上一次服务器确认的列表。
  - 使用递增 `requestId` 或 `AbortController` 防止旧响应覆盖最后一次查询结果。
  - 完成、恢复、编辑、删除成功后按当前条件重新查询，继续沿用既有 Todo 操作规则。
- [ ] 补充客户端和页面单测：序列化参数、初始加载、组合条件、清除、加载、中文无结果、错误重试、条件保留、写操作刷新和反序响应保护。
- [ ] 运行 Web 测试和类型检查：`pnpm --filter @todo/web test && pnpm typecheck`。

## 4. API 测试

依赖：1. 搜索接口、2. 筛选逻辑

- [ ] 在 `apps/api/test/todos/todo.repository.test.ts` 覆盖数据库层无条件查询、关键词包含匹配、`review`/`REVIEW` 大小写、首尾空白、三种状态、组合 AND、固定排序和无结果。
  - 断言使用绑定参数，不能通过 SQL 拼接用户输入实现。
- [ ] 在 `apps/api/test/todos/todo.api.test.ts` 覆盖：无参数、全空白 `q`、`all`、`active`、`completed`、组合查询、无结果和响应结构。
- [ ] 覆盖非法状态、数组或对象 query 值返回稳定的 `400 VALIDATION_ERROR`。
- [ ] 覆盖数据库失败和主要未知失败场景，确认返回安全的 500 错误且不包含 SQL 或堆栈信息。
- [ ] 覆盖既有写入接口回归，确认查询参数扩展没有改变新增、编辑、完成/恢复和删除语义。
- [ ] 运行 API、契约和类型门禁：`pnpm --filter @todo/contracts test && pnpm test:api && pnpm typecheck`。

## 5. E2E 测试

依赖：1–4 全部完成

- [ ] 在 `e2e/todos.spec.ts` 使用独立测试数据和真实 API/MySQL，准备混合标题与完成状态的 Todo。
- [ ] 使用可访问名称验证输入关键词后只显示匹配标题，且结果显示完整标题和完成状态。
- [ ] 验证切换“未完成”“已完成”“全部”时结果正确，关键词与状态组合时只显示交集。
- [ ] 验证清除关键词/状态条件恢复符合当前条件的列表，并验证无结果中文提示、加载反馈和错误重试（如现有 E2E 基础设施支持故障注入）。
- [ ] 在筛选结果中完成或恢复 Todo，确认页面按当前条件重新查询并移除不再匹配的项目，排序仍为未完成优先、同状态创建时间从新到旧。
- [ ] 运行完整交付门禁：`pnpm typecheck && pnpm --filter @todo/contracts test && pnpm test:api && pnpm --filter @todo/web test && pnpm test:e2e`。
- [ ] 若测试启动配置需要更新，仅修改 `README.md` 中的中文启动/测试说明，不提交环境变量、数据库凭据或其他敏感信息。
