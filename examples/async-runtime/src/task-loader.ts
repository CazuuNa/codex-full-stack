export interface Task {
    id: string;
    title: string;
}

export type LoadTask = (id: string) => Promise<Task>;

export interface LoadFailure {
  id: string;
  reason: unknown;
}

export interface BatchLoadResult {
  tasks: Task[];
  failures: LoadFailure[];
}


export async function loadSequentially(ids: string[], loadTask: LoadTask): Promise<Task[]> {
    const tasks: Task[] = [];

    for (const id of ids) {
        const task = await loadTask(id);
        tasks.push(task);
    }
    return tasks;
}

export async function loadConcurrently(ids: readonly string[], loadTask: LoadTask): Promise<Task[]> {
    return Promise.all(ids.map(id => loadTask(id)));
}

export async function loadAllSettled(
  ids: readonly string[],
  loadTask: LoadTask
): Promise<BatchLoadResult> {
  const settled = await Promise.allSettled(
    ids.map((id) => loadTask(id))
  );

  const tasks: Task[] = [];
  const failures: LoadFailure[] = [];

  settled.forEach((result, index) => {
    const id = ids[index];

    if (id === undefined) {
      throw new Error('MISSING_TASK_ID');
    }

    if (result.status === 'fulfilled') {
      tasks.push(result.value);
      return;
    }

    failures.push({
      id,
      reason: result.reason
    });
  });

  return {
    tasks,
    failures
  };
}
