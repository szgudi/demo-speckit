import mysql, { type Pool } from 'mysql2/promise';
import { readConfig } from '../config.js';
export function createPool(databaseUrl = readConfig().DATABASE_URL): Pool { return mysql.createPool(databaseUrl); }
export const pool = createPool();
