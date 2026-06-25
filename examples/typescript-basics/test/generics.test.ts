import { describe, expect, it } from 'vitest';
import { createPage, firstItem } from '../src/generics.js';

describe('generic helpers', () => {
  it('creates a typed page', () => {
    const page = createPage(
      [{ id: 'task-1', title: 'Learn generics' }],
      1,
      1,
      20
    );

    expect(page.items[0]?.title).toBe('Learn generics');
    expect(page.total).toBe(1);
  });

  it('returns undefined for an empty collection', () => {
    expect(firstItem([])).toBeUndefined();
  });
});