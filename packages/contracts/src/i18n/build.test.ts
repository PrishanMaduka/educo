import { describe, expect, it } from 'vitest';

import { buildArb } from './build';

describe('buildArb', () => {
  it('camel-cases keys and sets the locale', () => {
    const arb = buildArb({ 'a.b': 'Hello' });
    expect(arb['@@locale']).toBe('en');
    expect(arb['aB']).toBe('Hello');
  });

  // Flutter gen-l10n prints a plural's `#` literally, so the ARB names the argument instead.
  it('writes the plural argument in place of #', () => {
    const arb = buildArb({ 'a.b': '{count, plural, one {# x} other {# xs}}' });
    expect(arb['aB']).toBe('{count, plural, one {{count} x} other {{count} xs}}');
  });

  it('uses the innermost plural argument for # in nested plurals', () => {
    const arb = buildArb({ n: '{a, plural, other {# and {b, plural, other {# b}}}}' });
    expect(arb['n']).toBe('{a, plural, other {{a} and {b, plural, other {{b} b}}}}');
  });

  it('keeps apostrophes and literal text as written', () => {
    const message = "We couldn't find {count, plural, one {# page} other {# pages}}";
    expect(buildArb({ m: message })['m']).toBe(
      "We couldn't find {count, plural, one {{count} page} other {{count} pages}}",
    );
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
