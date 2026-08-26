import { z } from 'zod';

export const API_V1_TODOS_PATH = '/api/v1/todos';
export const TodoSchema = z.object({ id: z.string().uuid(), title: z.string().min(1).max(200), completed: z.boolean(), createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }) }).strict();
export type Todo = z.infer<typeof TodoSchema>;
const title = z.string().transform((value) => value.trim()).pipe(z.string().min(1, '标题不能为空').max(200, '标题不能超过 200 个字符'));
export const CreateTodoRequestSchema = z.object({ title }).strict();
export const UpdateTodoRequestSchema = z.object({ title: title.optional(), completed: z.boolean().optional() }).strict().refine((value) => value.title !== undefined || value.completed !== undefined, { message: '至少提供一个待更新字段' });
export type UpdateTodoInput = z.infer<typeof UpdateTodoRequestSchema>;
export const TodoListResponseSchema = z.object({ data: z.object({ items: z.array(TodoSchema) }).strict() }).strict();
export const TodoResponseSchema = z.object({ data: z.object({ todo: TodoSchema }).strict() }).strict();
export const TodoSearchStatusSchema = z.enum(['all', 'active', 'completed']);
export const TodoSearchQuerySchema = z.object({
  q: z.preprocess((value) => typeof value === 'string' && value.trim() === '' ? undefined : value, z.string().trim().min(1).optional()),
  status: TodoSearchStatusSchema.default('all'),
}).strict().transform(({ q, status }) => ({ ...(q === undefined ? {} : { keyword: q }), status }));
export type TodoSearchStatus = z.infer<typeof TodoSearchStatusSchema>;
export type TodoSearchQuery = z.infer<typeof TodoSearchQuerySchema>;
export const ApiErrorCodeSchema = z.enum(['VALIDATION_ERROR','TODO_NOT_FOUND','DATABASE_ERROR','INTERNAL_ERROR']);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export const ApiErrorResponseSchema = z.object({ error: z.object({ code: ApiErrorCodeSchema, message: z.string() }).strict() }).strict();
