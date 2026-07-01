import { delay } from './delay.js';
import {
  loadConcurrently,
  loadSequentially,
  type Task
} from './task-loader.js';

async function fakeLoadTask(id: string): Promise<Task> {
  return delay(100, {
    id,
    title: `Task ${id}`
  });
}

async function measure<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = performance.now();

  try {
    return await operation();
  } finally {
    const duration = performance.now() - start;
    console.log(`${label}: ${duration.toFixed(1)}ms`);
  }
}

const ids = ['1', '2', '3'];

await measure('sequential', () =>
  loadSequentially(ids, fakeLoadTask)
);

await measure('concurrent', () =>
  loadConcurrently(ids, fakeLoadTask)
);