import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildArb } from './build';

const load = (name: string): Record<string, string> =>
  JSON.parse(readFileSync(resolve(__dirname, '../../i18n', name), 'utf8')) as Record<string, string>;

describe('string catalogues', () => {
  it('keeps the staff style guide strings out of en.json (and so out of the parent app ARB)', () => {
    const en = load('en.json');
    expect(Object.keys(en).filter((key) => key.startsWith('design.'))).toEqual([]);
  });

  it('has a separate, valid ICU catalogue for the style guide', () => {
    const design = load('design.en.json');
    expect(design).toHaveProperty('title', 'Style guide');
    expect(() => buildArb(design)).not.toThrow();
  });
});
