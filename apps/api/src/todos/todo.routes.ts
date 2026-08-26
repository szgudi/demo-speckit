import { Router, type Request, type Response } from 'express';
import { API_V1_TODOS_PATH, CreateTodoRequestSchema, UpdateTodoRequestSchema } from '@todo/contracts';
import { TodoService } from './todo.service.js';
import { errorResponse } from '../http/errors.js';
import { z } from 'zod';
const idSchema=z.string().uuid();
export function todoRoutes(service:TodoService):Router { const router=Router(); const run=async(fn:()=>Promise<unknown>,res:Response):Promise<void>=>{try{await fn();}catch(error){const e=errorResponse(error);res.status(e.status).json(e.body);}}; router.get(API_V1_TODOS_PATH,(_,res)=>void run(async()=>{res.json({data:{items:await service.list()}});},res)); router.post(API_V1_TODOS_PATH,(req,res)=>void run(async()=>{const body=CreateTodoRequestSchema.parse(req.body as unknown);res.status(201).json({data:{todo:await service.create(body.title)}});},res)); router.patch(`${API_V1_TODOS_PATH}/:id`,(req,res)=>void run(async()=>{const id=idSchema.parse(req.params.id as unknown);const body=UpdateTodoRequestSchema.parse(req.body as unknown);res.json({data:{todo:await service.update(id,body)}});},res)); router.delete(`${API_V1_TODOS_PATH}/:id`,(req,res)=>void run(async()=>{await service.remove(idSchema.parse(req.params.id as unknown));res.status(204).send();},res)); return router; }
