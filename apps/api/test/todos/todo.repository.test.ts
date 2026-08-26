import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { readConfig } from '../../src/config.js';
import { TodoRepository } from '../../src/todos/todo.repository.js';

let pool:Pool;let repository:TodoRepository;
beforeAll(async()=>{const url=readConfig().TODO_TEST_DATABASE_URL ?? readConfig().DATABASE_URL;const db=await mysql.createConnection(url);await db.query('CREATE TABLE IF NOT EXISTS todos (id CHAR(36) PRIMARY KEY,title VARCHAR(200) NOT NULL,completed TINYINT(1) NOT NULL DEFAULT 0,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),INDEX idx_todos_completed_created(completed ASC,created_at DESC))');await db.end();pool=mysql.createPool(url);repository=new TodoRepository(pool);});
beforeEach(async()=>{await pool.execute('DELETE FROM todos');});
describe('TodoRepository',()=>{it('按未完成优先和创建时间倒序排序',async()=>{await repository.create('较早');await new Promise(resolve=>setTimeout(resolve,5));await repository.create('较晚');expect((await repository.list()).map(x=>x.title)).toEqual(['较晚','较早']);});it('不存在资源返回 null 和 false',async()=>{const id='00000000-0000-4000-8000-000000000000';expect(await repository.update(id,{completed:true})).toBeNull();expect(await repository.remove(id)).toBe(false);});
  it('按关键词和状态返回交集并支持大小写与空白', async () => {
    const active = await repository.create('Review 文档');
    await repository.create('采购清单');
    const completed = await repository.create('Review API');
    await repository.update(completed.id, { completed: true });
    expect((await repository.list({ keyword: '  REVIEW ', status: 'active' })).map(x => x.title)).toEqual([active.title]);
    expect((await repository.list({ keyword: 'review', status: 'completed' })).map(x => x.title)).toEqual(['Review API']);
    expect(await repository.list({ keyword: '不存在', status: 'all' })).toEqual([]);
  });
  it.each(['all', 'active', 'completed'] as const)('支持状态 %s', async status => {
    const active = await repository.create('未完成');
    const completed = await repository.create('已完成');
    await repository.update(completed.id, { completed: true });
    const result = await repository.list({ status });
    expect(result.map(x => x.id)).toEqual(status === 'all' ? [active.id, completed.id] : status === 'active' ? [active.id] : [completed.id]);
  });
});
