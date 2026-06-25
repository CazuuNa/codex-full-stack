import { describe, expect, it } from 'vitest';
import { createTask } from '../src/task.js';

describe('createTask', () => {
    it('creates a task with normalized title and default status', () => {  // 创建默认任务
        const task = createTask({
            title: 'Learn TypeScript',
        });
        expect(task.title).toBe('Learn TypeScript');
        expect(task.status).toBe('TODO');
        expect(task.id).toEqual(expect.any(String));
        expect(task.createdAt).toEqual(expect.any(String));
    });
    it('rejects a blank title', () => {  // 拒绝空标题
        expect(() => {
            createTask({ title: '   ' });
        }).toThrowError('TITLE_REQUIRED');
    });
    it('uses a supplied valid status', () => {  // 使用有效状态
               const task = createTask({
            title: 'Write tests',
            status: 'IN_PROGRESS',
        });

        expect(task.status).toBe('IN_PROGRESS');
    });
    it('rejects an invalid status', () => {  // 拒绝无效状态
        expect(() => {
            createTask({
                title: 'Write tests',
                status: 'WAITING',
            });
        }).toThrowError('INVALID_STATUS');
    });
});
