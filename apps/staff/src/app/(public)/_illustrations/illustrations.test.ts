import { describe, expect, it } from 'vitest';

import { circleDiagram, loopScenes, ruleIcons } from './circle';
import { dayScenes } from './day';
import { heroScene, kiteIcon } from './hero';
import {
  campusScene,
  ideaScenes,
  smallIcons,
  teaScene,
  trustScenes,
  villageScene,
} from './sections';

const scenes: [string, () => string][] = [
  ['hero', heroScene],
  ['kite icon', () => kiteIcon('jaya')],
  ['circle diagram', circleDiagram],
  ['village', villageScene],
  ['campus', campusScene],
  ['tea', teaScene],
  ...Object.entries(loopScenes),
  ...Object.entries(ruleIcons),
  ...Object.entries(dayScenes),
  ...Object.entries(ideaScenes),
  ...Object.entries(trustScenes),
  ...Object.entries(smallIcons),
];

describe('watercolour illustrations', () => {
  it.each(scenes)(
    '%s paints with token colours only (no raw hex, rgb or named colours)',
    (_, paint) => {
      const markup = paint();
      expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b(?!\))/i);
      expect(markup).not.toMatch(/\b(?:rgba?|hsla?)\(/);
      for (const [, colour] of markup.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)) {
        expect(colour, colour).toMatch(
          /^(?:none|url\(#\w+\)|var\(--quad-[\w-]+\)|color-mix\(.*\))$/,
        );
      }
    },
  );

  it('defines each mask once and renders the same markup every time (no randomness)', () => {
    expect(heroScene()).toBe(heroScene());
    const ids = scenes.flatMap(([, paint]) =>
      [...paint().matchAll(/<mask id="(\w+)"/g)].map((m) => m[1]),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
