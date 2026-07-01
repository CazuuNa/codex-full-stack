import crypto from 'node:crypto';

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type Task = {
  id: string,
  title: string,
  status: TaskStatus,
  createdAt: string,
}

const tasks: Task[] = [];

export function listTasks(): Task[] {
  return [...tasks]
}

export function createTask(title: string):Task {
  const normalizedTitle = title.trim();
  if (normalizedTitle === '') {
    throw new Error("TITLE_REQUIRED");
  }

  const task: Task = {
    id: crypto.randomUUID(),
    title: normalizedTitle,
    status: "TODO",
    createdAt: new Date().toISOString(),
  }

  tasks.push(task);
  return task;
}

// 测试用，清空所有任务
export function clearTasksForTest(): void {
  tasks.length = 0;
}