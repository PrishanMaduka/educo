import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { colors, contrastRatio } from '@quad/tokens';
import { describe, expect, it } from 'vitest';

import { fill, uiText } from './defaults';

const en = JSON.parse(
  readFileSync(join(__dirname, '../../../contracts/i18n/en.json'), 'utf8'),
) as Record<string, string>;

describe('uiText', () => {
  it('matches packages/contracts/i18n/en.json for every key', () => {
    for (const [key, value] of Object.entries(uiText)) expect(en[key], key).toBe(value);
  });

  it('fills placeholders', () => {
    expect(fill(uiText['ui.filter.clear'], { label: 'Year' })).toBe('Clear Year');
  });
});

describe('danger drawer icon tile', () => {
  it('keeps surface on bad at 3:1 or better in light and dark', () => {
    for (const mode of ['light', 'dark'] as const) {
      const set = colors[mode];
      expect(contrastRatio(set.surface, set.bad), mode).toBeGreaterThanOrEqual(3);
    }
  });
});
