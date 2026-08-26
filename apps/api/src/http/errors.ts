import { ZodError } from 'zod';
import { TodoNotFoundError } from '../todos/todo.service.js';
export function errorResponse(error: unknown): { status:number; body:{error:{code:string;message:string}} } { if(error instanceof ZodError)return {status:400,body:{error:{code:'VALIDATION_ERROR',message:'请求参数无效，请检查后重试'}}}; if(error instanceof TodoNotFoundError)return {status:404,body:{error:{code:'TODO_NOT_FOUND',message:error.message}}}; return {status:500,body:{error:{code:'DATABASE_ERROR',message:'服务暂时不可用，请稍后重试'}}}; }
