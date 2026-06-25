import { randomUUID } from 'node:crypto';

export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'DONE'
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export interface Task {
  readonly id: string;
  title: string;
  status: TaskStatus;
  description?: string;
  createdAt: string;
}

export interface CreateTaskInput {
  title: unknown;
  status?: unknown;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === 'string' &&
    TASK_STATUSES.some((status) => status === value)
  );
}

export function createTask(input: CreateTaskInput): Task {
  if (typeof input.title !== 'string') {
    throw new Error('TITLE_MUST_BE_STRING');
  }

  const title = input.title.trim();

  if (!title) {
    throw new Error('TITLE_REQUIRED');
  }

  let status: TaskStatus = 'TODO';

  if (input.status !== undefined) {
    if (!isTaskStatus(input.status)) {
      throw new Error('INVALID_STATUS');
    }

    status = input.status;
  }

  return {
    id: randomUUID(),
    title,
    status,
    createdAt: new Date().toISOString()
  };
}