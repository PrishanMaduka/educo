import { colors, contrastRatio, mix } from '@quad/tokens';
import { describe, expect, it } from 'vitest';

import { avatarPalette, avatarTone, AVATAR_TINT, initialsOf } from './avatar';

describe('initialsOf', () => {
  it('takes the first and last word', () => {
    expect(initialsOf('Amaya Perera')).toBe('AP');
    expect(initialsOf('  amaya  de   silva ')).toBe('AS');
    expect(initialsOf('Hasini')).toBe('H');
    expect(initialsOf('')).toBe('?');
  });
});

describe('avatarTone', () => {
  it('is stable for the same name and spreads names over the palette', () => {
    expect(avatarTone('Amaya Perera')).toBe(avatarTone('Amaya Perera'));
    const used = new Set(
      [
        'Amaya Perera',
        'Ruwan Mendis',
        'Nadeesha Jayasinghe',
        'Prishan Maduka',
        'Hasini Fernando',
        'Kavindu Silva',
        'Imani Cole',
        'Tariq Aziz',
      ].map(avatarTone),
    );
    expect(used.size).toBeGreaterThan(2);
  });
});

describe('avatarPalette contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const entry of avatarPalette) {
      it(`${entry.token} tint with ink text passes AA in ${theme}`, () => {
        const set = colors[theme] as Record<string, string>;
        const bg = mix(set[entry.token]!, AVATAR_TINT, set.surface!);
        expect(contrastRatio(set.ink!, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
