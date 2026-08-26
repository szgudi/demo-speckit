import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { readConfig } from '../src/config.js';

const config = readConfig();
const url = process.env.MIGRATE_TEST === '1' ? (process.env.TODO_TEST_DATABASE_URL ?? config.DATABASE_URL) : config.DATABASE_URL;
const connection = await mysql.createConnection(url);
await connection.query(await readFile(fileURLToPath(new URL('../migrations/001_create_todos.sql', import.meta.url)), 'utf8'));
await connection.end();
console.log('数据库迁移完成');
