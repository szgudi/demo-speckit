import { test, expect } from '@playwright/test';
import mysql from 'mysql2/promise';

test.beforeEach(async()=>{const url=process.env.TODO_TEST_DATABASE_URL;if(!url)throw new Error('缺少 TODO_TEST_DATABASE_URL');const db=await mysql.createConnection(url);await db.execute('DELETE FROM todos');await db.end();});
test('新增、完成、刷新并删除待办',async({page})=>{await page.goto('http://127.0.0.1:5173');await page.getByLabel('新的待办标题').fill('准备周报');await page.getByRole('button',{name:'新增'}).click();await expect(page.getByText('准备周报')).toBeVisible();await page.getByRole('button',{name:'标记完成'}).click();await page.reload();await expect(page.getByText('准备周报')).toHaveClass(/done/);await page.getByRole('button',{name:'删除待办'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'确认删除'}).click();await expect(page.getByText('还没有待办，新增第一条吧。')).toBeVisible();});
test('按关键词、状态和组合条件筛选，并清除条件',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  const titleInput=page.getByLabel('新的待办标题');
  const add=async(title:string)=>{await titleInput.fill(title);await page.getByRole('button',{name:'新增'}).click();await expect(page.getByText(title,{exact:true})).toBeVisible();};
  await add('采购未完成');
  await add('采购已完成');
  await page.getByText('采购已完成',{exact:true}).locator('..').getByRole('button',{name:'标记完成'}).click();
  await add('会议未完成');
  const search=page.getByRole('searchbox',{name:'搜索待办标题'});
  await search.fill('采购');await page.getByRole('button',{name:'搜索'}).click();
  await expect(page.getByText('采购未完成',{exact:true})).toBeVisible();await expect(page.getByText('采购已完成',{exact:true})).toBeVisible();await expect(page.getByText('会议未完成',{exact:true})).not.toBeVisible();
  await page.getByRole('combobox',{name:'完成状态筛选'}).selectOption('active');
  await expect(page.getByText('采购未完成',{exact:true})).toBeVisible();await expect(page.getByText('采购已完成',{exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'清除搜索条件'}).click();
  await expect(page.getByText('采购未完成',{exact:true})).toBeVisible();await expect(page.getByText('采购已完成',{exact:true})).toBeVisible();await expect(page.getByText('会议未完成',{exact:true})).toBeVisible();
});
