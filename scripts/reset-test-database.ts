import mysql from 'mysql2/promise';
const url=process.env.TODO_TEST_DATABASE_URL;
if(!url)throw new Error('缺少 TODO_TEST_DATABASE_URL');
const database=new URL(url).pathname.slice(1);
if(!database.endsWith('_test'))throw new Error('测试数据库名称必须以 _test 结尾');
const db=await mysql.createConnection(url);await db.execute('DELETE FROM todos');await db.end();console.log('测试数据库已清理');
