import {beforeEach,describe,expect,it} from 'vitest';

import {createTask, listTasks, clearTasksForTest} from '../src/task-store.js';

describe('createTask', () => {
  beforeEach(() => { // 每个测试用例执行前，清空所有任务
    clearTasksForTest();
  })

  it('starts with empty list', () => {
    expect(listTasks()).toEqual([]);
  }) // 测试创建任务前，任务列表为空

  it("starts with empty task list", () => {
    expect(listTasks()).toEqual([]);
  });

  it("creates a task with normalized title", () => {
    const task = createTask("  Learn HTTP  ");

    expect(task.title).toBe("Learn HTTP");
    expect(task.status).toBe("TODO");
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toEqual(expect.any(String));

    expect(listTasks()).toHaveLength(1);
  });

  it("rejects empty title", () => {
    expect(() => createTask("   ")).toThrow("TITLE_REQUIRED");
  });
})