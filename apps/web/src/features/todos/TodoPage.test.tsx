import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoPage } from './TodoPage.js';
const todo={id:'00000000-0000-4000-8000-000000000001',title:'旧待办',completed:false,createdAt:'2026-08-26T00:00:00.000Z',updatedAt:'2026-08-26T00:00:00.000Z'};
afterEach(()=>vi.restoreAllMocks());
describe('TodoPage',()=>{it('加载完成后显示空状态',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({data:{items:[]}}),{status:200}));render(<TodoPage/>);expect(screen.getByText('正在加载待办…')).toBeInTheDocument();await expect(screen.findByText('还没有待办，新增第一条吧。')).resolves.toBeInTheDocument();});it('新增成功后清空输入并显示服务器待办',async()=>{const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({data:{items:[]}}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({data:{todo}}),{status:201}));render(<TodoPage/>);await waitFor(()=>expect(screen.getByText('还没有待办，新增第一条吧。')).toBeInTheDocument());const input=screen.getByLabelText('新的待办标题');await userEvent.type(input,'  新待办  ');await userEvent.click(screen.getByRole('button',{name:'新增'}));await expect(screen.findByText('旧待办')).resolves.toBeInTheDocument();expect(input).toHaveValue('');expect(fetchMock).toHaveBeenCalledTimes(2);});});
