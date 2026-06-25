import { createTask } from './task.js';

const task = createTask({
  title: 'Complete TypeScript Day 2',
  status: 'IN_PROGRESS'
});

console.log(task);