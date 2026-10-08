import { describe, expect, it } from 'vitest';

import { typedAt } from './TypedAnswer';

describe('typedAt', () => {
  const answer = 'Four students.';

  it('types one letter per step from empty', () => {
    expect(typedAt(answer, 0)).toBe('');
    expect(typedAt(answer, 4)).toBe('Four');
  });

  it('holds the whole answer for the pause, then starts again', () => {
    expect(typedAt(answer, answer.length)).toBe(answer);
    expect(typedAt(answer, answer.length + 30)).toBe(answer);
    expect(typedAt(answer, answer.length + 31)).toBe('');
  });
});
