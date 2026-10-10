import { describe, expect, it } from 'vitest';

import { HIDDEN_CHARACTER, hasHiddenCharacter } from './text';

describe('hasHiddenCharacter (D32)', () => {
  it('finds control and invisible format characters', () => {
    for (const text of ['a\rb', 'a\u0000b', 'a\u007fb', 'a‮b', 'a​b', '﻿ab']) {
      expect(hasHiddenCharacter(text, { lineBreaks: true }), JSON.stringify(text)).toBe(true);
    }
  });

  it('allows a line feed only where line breaks are allowed', () => {
    expect(hasHiddenCharacter('a\nb', { lineBreaks: true })).toBe(false);
    expect(hasHiddenCharacter('a\nb', { lineBreaks: false })).toBe(true);
  });

  it('allows the zero-width joiner and non-joiner, and ordinary text', () => {
    expect(hasHiddenCharacter('ශ්‍රී ක‌ෂ', { lineBreaks: false })).toBe(false);
    expect(hasHiddenCharacter('Sample School, Lisbon', { lineBreaks: false })).toBe(false);
  });

  it('is the same rule the support reason uses', () => {
    expect(HIDDEN_CHARACTER.test('a\nb')).toBe(false);
    expect(HIDDEN_CHARACTER.test('a‮b')).toBe(true);
  });
});
