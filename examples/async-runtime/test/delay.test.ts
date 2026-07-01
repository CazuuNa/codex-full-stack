import { describe, expect, it } from 'vitest';
import { delay } from '../src/delay.js';

describe('delay', () => {
  it('resolves with the supplied value', async () => {
    const result = await delay(10, 'completed');

    expect(result).toBe('completed');
  });
});