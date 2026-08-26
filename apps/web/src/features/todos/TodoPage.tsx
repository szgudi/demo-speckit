import { useCallback, useEffect, useRef, useState } from 'react';
import { TodoSearchStatusSchema, type Todo, type TodoSearchStatus, type UpdateTodoInput } from '@todo/contracts';
import { ApiClientError } from '../../api/apiClientError.js';
import { todoApiClient } from '../../api/todoApiClient.js';
import { validateTitle } from './todoValidation.js';
import './styles.css';

const emptyQuery = { keyword: '', status: 'all' as TodoSearchStatus };

export function TodoPage() {
  const [items, setItems] = useState<Todo[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [status, setStatus] = useState<TodoSearchStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (nextKeyword: string, nextStatus: TodoSearchStatus) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const nextItems = await todoApiClient.list({ keyword: nextKeyword.trim() || undefined, status: nextStatus });
      if (requestId === requestIdRef.current) setItems(nextItems);
    } catch (cause) {
      if (requestId === requestIdRef.current) setError(cause instanceof Error ? cause.message : '读取失败，请稍后重试');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(emptyQuery.keyword, emptyQuery.status); }, [load]);

  const submitSearch = (event: React.FormEvent) => { event.preventDefault(); void load(keywordInput, status); };
  const changeStatus = (value: string) => { const nextStatus = TodoSearchStatusSchema.parse(value); setStatus(nextStatus); void load(keywordInput, nextStatus); };
  const clearKeyword = () => { setKeywordInput(''); void load('', status); };
  const clearAll = () => { setKeywordInput(''); setStatus('all'); void load('', 'all'); };
  const reload = () => void load(keywordInput, status);

  const refreshAfterWrite = async () => { await load(keywordInput, status); setNotice('已更新'); };
  const saveNew = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = validateTitle(title);
    if (message) { setError(message); return; }
    try { await todoApiClient.create(title); setTitle(''); setError(''); await refreshAfterWrite(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请稍后重试'); }
  };
  const update = async (item: Todo, patch: UpdateTodoInput) => {
    try { await todoApiClient.update(item.id, patch); await refreshAfterWrite(); }
    catch (cause) {
      if (cause instanceof ApiClientError && cause.code === 'TODO_NOT_FOUND') setError('该待办已不存在，已重新加载列表');
      else setError(cause instanceof Error ? cause.message : '更新失败，请稍后重试');
    }
  };
  const remove = async () => {
    if (!deleting) return;
    const item = deleting;
    setDeleting(null);
    try { await todoApiClient.remove(item.id); await refreshAfterWrite(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败，请稍后重试'); }
  };

  const hasCondition = Boolean(keywordInput.trim()) || status !== 'all';
  return <main>
    <h1>待办清单</h1>
    <form onSubmit={saveNew}><label htmlFor="new-title">新的待办标题</label><div className="new-row"><input id="new-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={200}/><button type="submit">新增</button></div></form>
    <form className="search-row" role="search" onSubmit={submitSearch}>
      <label htmlFor="todo-search">搜索待办标题</label><input id="todo-search" role="searchbox" value={keywordInput} onChange={event => setKeywordInput(event.target.value)} placeholder="输入标题关键词"/>
      <button type="submit">搜索</button>{keywordInput && <button type="button" onClick={clearKeyword}>清除搜索</button>}
      <label htmlFor="todo-status">完成状态筛选</label><select id="todo-status" value={status} onChange={event => changeStatus(event.target.value)}><option value="all">全部</option><option value="active">未完成</option><option value="completed">已完成</option></select>
      {hasCondition && <button type="button" onClick={clearAll}>清除搜索条件</button>}
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert">{error}<button type="button" onClick={reload}>重新加载</button></div>}
    {loading ? <p role="status" aria-live="polite">正在加载待办…</p> : items.length === 0 ? <p role="status" aria-live="polite">{hasCondition ? '没有找到匹配待办' : '还没有待办，新增第一条吧。'}</p> : <ul>{items.map(item => <li key={item.id}>
      {editing === item.id ? <input aria-label="编辑待办标题" autoFocus value={editTitle} onChange={event => setEditTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { const message = validateTitle(editTitle); if (message) setError(message); else { void update(item, { title: editTitle }); setEditing(null); } } if (event.key === 'Escape') { setEditing(null); setEditTitle(item.title); } }}/> : <span className={item.completed ? 'done' : ''}>{item.title}</span>}
      <button type="button" aria-label={item.completed ? '恢复待办' : '标记完成'} onClick={() => void update(item, { completed: !item.completed })}>{item.completed ? '恢复' : '完成'}</button><button type="button" aria-label="编辑待办" onClick={() => { setEditing(item.id); setEditTitle(item.title); }}>编辑</button><button type="button" aria-label="删除待办" onClick={() => setDeleting(item)}>删除</button>
    </li>)}</ul>}
    {deleting && <div role="dialog" aria-modal="true"><p>确定要永久删除“{deleting.title}”吗？</p><button type="button" onClick={() => void remove()}>确认删除</button><button type="button" onClick={() => setDeleting(null)}>取消</button></div>}
  </main>;
}
