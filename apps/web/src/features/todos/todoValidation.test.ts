import { describe, expect, it } from 'vitest';
import { validateTitle } from './todoValidation.js';
describe('待办标题校验',()=>{it('拒绝空白和超长标题',()=>{expect(validateTitle('   ')).toBe('标题不能为空');expect(validateTitle('x'.repeat(201))).toContain('200');});it('接受并允许 trim 有效标题',()=>expect(validateTitle('  写报告  ')).toBeNull());});
