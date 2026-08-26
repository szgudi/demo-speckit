import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { readConfig } from '../../src/config.js';
import { TodoRepository } from '../../src/todos/todo.repository.js';

let pool:Pool;let repository:TodoRepository;
beforeAll(async()=>{const url=readConfig().TODO_TEST_DATABASE_URL ?? readConfig().DATABASE_URL;const db=await mysql.createConnection(url);await db.query('CREATE TABLE IF NOT EXISTS todos (id CHAR(36) PRIMARY KEY,title VARCHAR(200) NOT NULL,completed TINYINT(1) NOT NULL DEFAULT 0,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),INDEX idx_todos_completed_created(completed ASC,created_at DESC))');await db.end();pool=mysql.createPool(url);repository=new TodoRepository(pool);});
beforeEach(async()=>{await pool.execute('DELETE FROM todos');});
describe('TodoRepository',()=>{it('按未完成优先和创建时间倒序排序',async()=>{await repository.create('较早');await new Promise(resolve=>setTimeout(resolve,5));await repository.create('较晚');expect((await repository.list()).map(x=>x.title)).toEqual(['较晚','较早']);});it('不存在资源返回 null 和 false',async()=>{const id='00000000-0000-4000-8000-000000000000';expect(await repository.update(id,{completed:true})).toBeNull();expect(await repository.remove(id)).toBe(false);});});
