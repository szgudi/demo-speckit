import { Router, type Request, type Response } from 'express';
import { API_V1_TODOS_PATH, CreateTodoRequestSchema, TodoSearchQuerySchema, UpdateTodoRequestSchema, type TodoSearchQuery } from '@todo/contracts';
import { TodoService } from './todo.service.js';
import { errorResponse } from '../http/errors.js';
import { z } from 'zod';
const idSchema=z.string().uuid();
function parseSearchQuery(value: unknown): TodoSearchQuery {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new z.ZodError([]);
  const q = 'q' in value ? value.q : undefined;
  const status = 'status' in value ? value.status : undefined;
  const queryValues = { q, status };
  if (Array.isArray(queryValues.q) || (queryValues.q !== undefined && typeof queryValues.q !== 'string') || Array.isArray(queryValues.status) || (queryValues.status !== undefined && typeof queryValues.status !== 'string')) throw new z.ZodError([]);
  return TodoSearchQuerySchema.parse(queryValues);
}
export function todoRoutes(service:TodoService):Router { const router=Router(); const run=async(fn:()=>Promise<unknown>,res:Response):Promise<void>=>{try{await fn();}catch(error){const e=errorResponse(error);res.status(e.status).json(e.body);}}; router.get(API_V1_TODOS_PATH,(req,res)=>void run(async()=>{res.json({data:{items:await service.list(parseSearchQuery(req.query))}});},res)); router.post(API_V1_TODOS_PATH,(req,res)=>void run(async()=>{const body=CreateTodoRequestSchema.parse(req.body as unknown);res.status(201).json({data:{todo:await service.create(body.title)}});},res)); router.patch(`${API_V1_TODOS_PATH}/:id`,(req,res)=>void run(async()=>{const id=idSchema.parse(req.params.id as unknown);const body=UpdateTodoRequestSchema.parse(req.body as unknown);res.json({data:{todo:await service.update(id,body)}});},res)); router.delete(`${API_V1_TODOS_PATH}/:id`,(req,res)=>void run(async()=>{await service.remove(idSchema.parse(req.params.id as unknown));res.status(204).send();},res)); return router; }
