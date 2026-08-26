import type { Todo, UpdateTodoInput } from '@todo/contracts';
import { TodoRepository } from './todo.repository.js';
export class TodoService { public constructor(private readonly repository: TodoRepository) {} public list(){return this.repository.list();} public create(title:string){return this.repository.create(title.trim());} public async update(id:string,patch:UpdateTodoInput):Promise<Todo>{const item=await this.repository.update(id,patch);if(!item)throw new TodoNotFoundError();return item;} public async remove(id:string):Promise<void>{if(!(await this.repository.remove(id)))throw new TodoNotFoundError();} }
export class TodoNotFoundError extends Error { public constructor(){super('该待办已不存在，请重新加载');this.name='TodoNotFoundError';} }
