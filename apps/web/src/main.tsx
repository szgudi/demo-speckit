import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TodoPage } from './features/todos/TodoPage.js';
const root = document.getElementById('root');
if (!root) throw new Error('页面根节点不存在');
createRoot(root).render(<StrictMode><TodoPage /></StrictMode>);
