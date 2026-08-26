import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mysql from 'mysql2/promise';
import { createApp } from '../../src/app.js';
import { TodoRepository } from '../../src/todos/todo.repository.js';
import { readConfig } from '../../src/config.js';
import type { Pool } from 'mysql2/promise';

let pool:Pool;
beforeAll(async()=>{const connection=await mysql.createConnection(readConfig().TODO_TEST_DATABASE_URL ?? readConfig().DATABASE_URL);await connection.query('CREATE TABLE IF NOT EXISTS todos (id CHAR(36) PRIMARY KEY,title VARCHAR(200) NOT NULL,completed TINYINT(1) NOT NULL DEFAULT 0,created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),INDEX idx_todos_completed_created(completed ASC,created_at DESC))');await connection.end();pool=mysql.createPool(readConfig().TODO_TEST_DATABASE_URL ?? readConfig().DATABASE_URL);});
beforeEach(async()=>{await pool.execute('DELETE FROM todos');});
describe('Todo API',()=>{it('创建、读取、更新、完成并删除',async()=>{const app=createApp(new TodoRepository(pool));const created=await request(app).post('/api/v1/todos').send({title:'  写测试  '}).expect(201);expect(created.body.data.todo.title).toBe('写测试');const id=created.body.data.todo.id;await request(app).patch(`/api/v1/todos/${id}`).send({completed:true}).expect(200);const list=await request(app).get('/api/v1/todos').expect(200);expect(list.body.data.items[0].completed).toBe(true);await request(app).delete(`/api/v1/todos/${id}`).expect(204);});it('拒绝无效请求和不存在资源',async()=>{const app=createApp(new TodoRepository(pool));await request(app).post('/api/v1/todos').send({title:' '}).expect(400);await request(app).patch('/api/v1/todos/not-uuid').send({}).expect(400);await request(app).delete('/api/v1/todos/00000000-0000-4000-8000-000000000000').expect(404);});
  it('支持关键词、状态、空白关键词和安全响应结构', async () => {
    const app = createApp(new TodoRepository(pool));
    const active = await request(app).post('/api/v1/todos').send({ title: 'Review 文档' }).expect(201);
    const completed = await request(app).post('/api/v1/todos').send({ title: 'Review API' }).expect(201);
    await request(app).patch(`/api/v1/todos/${completed.body.data.todo.id}`).send({ completed: true }).expect(200);
    const response = await request(app).get('/api/v1/todos?q=%20review%20&status=active').expect(200);
    expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([active.body.data.todo.id]);
    expect((await request(app).get('/api/v1/todos?q=%20%20').expect(200)).body.data.items).toHaveLength(2);
  });
  it.each(['/api/v1/todos?status=pending', '/api/v1/todos?status[]=active', '/api/v1/todos?status[x]=active'])('拒绝非法查询值 %s', async path => {
    const app = createApp(new TodoRepository(pool));
    const response = await request(app).get(path).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
