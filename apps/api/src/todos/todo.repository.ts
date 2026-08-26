import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket, Pool } from 'mysql2/promise';
import type { Todo, TodoSearchQuery, UpdateTodoInput } from '@todo/contracts';

type TodoRow = RowDataPacket & { id:string; title:string; completed: number; created_at: Date|string; updated_at: Date|string };
function mapRow(row: TodoRow): Todo { const iso = (value: Date|string) => new Date(value).toISOString(); return { id: row.id, title: row.title, completed: row.completed === 1, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }; }
export class TodoRepository {
  public constructor(private readonly db: Pool) {}
  public async list(query: TodoSearchQuery = { status: 'all' }): Promise<Todo[]> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    const keyword = query.keyword?.trim();
    if (keyword) {
      conditions.push('LOWER(title) LIKE LOWER(?)');
      values.push(`%${keyword}%`);
    }
    if (query.status === 'active') {
      conditions.push('completed = ?');
      values.push(0);
    } else if (query.status === 'completed') {
      conditions.push('completed = ?');
      values.push(1);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT id,title,completed,created_at,updated_at FROM todos${where} ORDER BY completed ASC, created_at DESC`;
    const [rows] = await this.db.execute<TodoRow[]>(sql, values);
    return rows.map(mapRow);
  }
  public async create(title: string): Promise<Todo> { const id=randomUUID(); await this.db.execute('INSERT INTO todos (id,title) VALUES (?,?)',[id,title]); const item=await this.find(id); if (!item) throw new Error('创建待办后无法读取'); return item; }
  public async update(id: string, patch: UpdateTodoInput): Promise<Todo|null> { const fields:string[]=[]; const values:(string|number)[]=[]; if(patch.title!==undefined){fields.push('title = ?');values.push(patch.title);} if(patch.completed!==undefined){fields.push('completed = ?');values.push(patch.completed ? 1 : 0);} values.push(id); const [result] = await this.db.execute<ResultSetHeader>(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`,values); return result.affectedRows===0 ? null : this.find(id); }
  public async remove(id: string): Promise<boolean> { const [result] = await this.db.execute<ResultSetHeader>('DELETE FROM todos WHERE id = ?',[id]); return result.affectedRows===1; }
  private async find(id:string):Promise<Todo|null>{const [rows]=await this.db.execute<TodoRow[]>('SELECT id,title,completed,created_at,updated_at FROM todos WHERE id = ?',[id]); return rows[0] ? mapRow(rows[0]) : null;}
}
