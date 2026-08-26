import { createApp } from './app.js';
import { pool } from './database/pool.js';
import { readConfig } from './config.js';
createApp(new (await import('./todos/todo.repository.js')).TodoRepository(pool)).listen(readConfig().API_PORT,()=>console.log(`API 已启动，端口 ${readConfig().API_PORT}`));
