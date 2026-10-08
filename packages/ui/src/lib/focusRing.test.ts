import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { focusRing } from './motion';

describe('focusRing', () => {
  it('is the one place the 2 px brand outline with 2 px offset is spelled out', () => {
    expect(focusRing).toContain('focus-visible:outline-2');
    expect(focusRing).toContain('focus-visible:outline-offset-2');
    const dir = join(__dirname, '../components');
    for (const file of readdirSync(dir).filter((f) => /\.tsx$/.test(f) && !f.includes('.test.'))) {
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toContain('focus-visible:outline-2');
    }
  });
});
