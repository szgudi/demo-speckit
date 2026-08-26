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
describe('Todo API',()=>{it('创建、读取、更新、完成并删除',async()=>{const app=createApp(new TodoRepository(pool));const created=await request(app).post('/api/v1/todos').send({title:'  写测试  '}).expect(201);expect(created.body.data.todo.title).toBe('写测试');const id=created.body.data.todo.id;await request(app).patch(`/api/v1/todos/${id}`).send({completed:true}).expect(200);const list=await request(app).get('/api/v1/todos').expect(200);expect(list.body.data.items[0].completed).toBe(true);await request(app).delete(`/api/v1/todos/${id}`).expect(204);});it('拒绝无效请求和不存在资源',async()=>{const app=createApp(new TodoRepository(pool));await request(app).post('/api/v1/todos').send({title:' '}).expect(400);await request(app).patch('/api/v1/todos/not-uuid').send({}).expect(400);await request(app).delete('/api/v1/todos/00000000-0000-4000-8000-000000000000').expect(404);});});
