import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';

test.beforeEach(async()=>{const url=process.env.TODO_TEST_DATABASE_URL;if(!url)throw new Error('缺少 TODO_TEST_DATABASE_URL');const db=await mysql.createConnection(url);await db.execute('DELETE FROM todos');await db.end();});
test('新增、完成、刷新并删除待办',async({page})=>{await page.goto('http://127.0.0.1:5173');await page.getByLabel('新的待办标题').fill('准备周报');await page.getByRole('button',{name:'新增'}).click();await expect(page.getByText('准备周报')).toBeVisible();await page.getByRole('button',{name:'标记完成'}).click();await page.reload();await expect(page.getByText('准备周报')).toHaveClass(/done/);await page.getByRole('button',{name:'删除待办'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'确认删除'}).click();await expect(page.getByText('还没有待办，新增第一条吧。')).toBeVisible();});
