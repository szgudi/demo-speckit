import express from 'express';
import type { Express } from 'express';
import { pool } from './database/pool.js';
import { TodoRepository } from './todos/todo.repository.js';
import { TodoService } from './todos/todo.service.js';
import { todoRoutes } from './todos/todo.routes.js';
export function createApp(repository:TodoRepository = new TodoRepository(pool)):Express{const app=express();app.use((_req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5173');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');if(_req.method==='OPTIONS')return res.sendStatus(204);next();});app.use(express.json());app.get('/',(_req,res)=>res.json({status:'ok'}));const service=new TodoService(repository);app.use(todoRoutes(service));app.use((_req,res)=>res.status(500).json({error:{code:'INTERNAL_ERROR',message:'服务暂时不可用，请稍后重试'}}));return app;}
