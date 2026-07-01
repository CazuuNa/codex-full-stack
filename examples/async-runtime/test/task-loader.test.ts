import { describe, expect, it } from 'vitest';
import { loadSequentially, loadConcurrently, loadAllSettled, type LoadTask } from '../src/task-loader.js';

describe('loadSequentially', () => {
    it('starts each load after the previous load finishes', async () => {
        const events: string[] = [];

        const loadTask = async (id: string) => {
            events.push('start:' + id);
            await new Promise(resolve => setTimeout(resolve, 10));
            events.push('end:' + id);
            return {
                id,
                title: `Task ${id} task`,
            };
        };
        const result = await loadSequentially(['1', '2', '3'], loadTask);

        expect(result.map(task => task.id)).toEqual(['1', '2', '3']);

        expect(events).toEqual(['start:1', 'end:1', 'start:2', 'end:2', 'start:3', 'end:3']);
    });

    it('starts every load before any load finishes', async () => {
        const events: string[] = [];

        const loadTask = async (id: string) => {
            events.push(`start:${id}`);
            await new Promise(resolve => setTimeout(resolve, 20));
            events.push(`end:${id}`);

            return {
                id,
                title: `Task ${id}`,
            };
        };

        const result = await loadConcurrently(['1', '2', '3'], loadTask);

        expect(result.map(task => task.id)).toEqual(['1', '2', '3']);

        expect(events.slice(0, 3)).toEqual(['start:1', 'start:2', 'start:3']);
    });

    it('returns successful tasks and failures swparately', async () => {
        const loadTask: LoadTask = async id => {
            if (id === '2') {
                throw new Error('Failed to load task 2');
            }
            return {
                id,
                title: `Task ${id}`,
            };
        };
        const result = await loadAllSettled(['1', '2', '3'], loadTask);
        expect(result.tasks.map(task => task.id)).toEqual(['1', '3']);

        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]?.id).toBe('2');
        expect(result.failures[0]?.reason).toBeInstanceOf(Error);
    });
});
