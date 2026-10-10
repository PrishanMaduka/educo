import { describe, expect, it } from 'vitest';

import { HIDDEN_CHARACTER, hasHiddenCharacter } from './text';

describe('hasHiddenCharacter (D32)', () => {
  it('finds control and invisible format characters', () => {
    for (const text of ['a\rb', 'a\u0000b', 'a\u007fb', 'a\u202Eb', 'a\u200Bb', '\uFEFFab']) {
      expect(hasHiddenCharacter(text, { lineBreaks: true }), JSON.stringify(text)).toBe(true);
    }
  });

  it('allows a line feed only where line breaks are allowed', () => {
    expect(hasHiddenCharacter('a\nb', { lineBreaks: true })).toBe(false);
    expect(hasHiddenCharacter('a\nb', { lineBreaks: false })).toBe(true);
  });

  it('refuses the Unicode line and paragraph separators in single-line fields', () => {
    for (const text of ['a b', 'a b']) {
      expect(hasHiddenCharacter(text, { lineBreaks: false }), JSON.stringify(text)).toBe(true);
    }
  });

  it('allows the zero-width joiner and non-joiner, and ordinary text', () => {
    expect(hasHiddenCharacter('ශ්\u200Dරී ක\u200Cෂ', { lineBreaks: false })).toBe(false);
    expect(hasHiddenCharacter('Sample School, Lisbon', { lineBreaks: false })).toBe(false);
  });

  it('is the same rule the support reason uses', () => {
    expect(HIDDEN_CHARACTER.test('a\nb')).toBe(false);
    expect(HIDDEN_CHARACTER.test('a\u202Eb')).toBe(true);
  });
});
