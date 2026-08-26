import { describe, expect, it } from 'vitest';
import { CreateTodoRequestSchema, TodoSearchQuerySchema, UpdateTodoRequestSchema } from '../src/todo.js';

describe('Todo 契约', () => {
  it.each(['   ', 'x'.repeat(201)])('拒绝无效标题', (value) => expect(CreateTodoRequestSchema.safeParse({ title: value }).success).toBe(false));
  it('拒绝非法 UUID 和空 PATCH', async () => {
    const { TodoSchema } = await import('../src/todo.js');
    expect(TodoSchema.safeParse({ id: 'bad', title: 'x', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).success).toBe(false);
    expect(UpdateTodoRequestSchema.safeParse({}).success).toBe(false);
  });
  it('拒绝多余字段并 trim 标题', () => {
    expect(CreateTodoRequestSchema.safeParse({ title: '  做事  ', extra: true }).success).toBe(false);
    expect(CreateTodoRequestSchema.parse({ title: '  做事  ' }).title).toBe('做事');
  });
  it('将搜索关键词首尾空白归一化并默认全部状态', () => {
    expect(TodoSearchQuerySchema.parse({ q: '  Review  ' })).toEqual({ keyword: 'Review', status: 'all' });
    expect(TodoSearchQuerySchema.parse({ q: '   ' })).toEqual({ status: 'all' });
    expect(TodoSearchQuerySchema.parse({})).toEqual({ status: 'all' });
  });
  it.each(['pending', '', 'ACTIVE'])('拒绝非法状态 %s', (status) => {
    expect(TodoSearchQuerySchema.safeParse({ status }).success).toBe(false);
  });
});
