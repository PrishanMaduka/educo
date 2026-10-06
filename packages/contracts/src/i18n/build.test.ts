import { describe, expect, it } from 'vitest';

import { buildArb } from './build';

describe('buildArb', () => {
  it('camel-cases keys and sets the locale', () => {
    const arb = buildArb({ 'a.b': '{count, plural, one {# x} other {# xs}}' });
    expect(arb['@@locale']).toBe('en');
    expect(arb['aB']).toBe('{count, plural, one {# x} other {# xs}}');
  });

  it('adds placeholder metadata for ICU arguments', () => {
    const arb = buildArb({
      'students.count': '{count, plural, one {# student} other {# students}}',
    });
    expect(arb['@studentsCount']).toEqual({ placeholders: { count: { type: 'num' } } });
  });

  it('adds no metadata for plain messages', () => {
    expect(buildArb({ 'nav.home': 'Home' })).toEqual({ '@@locale': 'en', navHome: 'Home' });
  });

  it('names the key when a message is invalid', () => {
    expect(() => buildArb({ bad: '{count, plural, one {x}' })).toThrow(/bad/);
  });
});
