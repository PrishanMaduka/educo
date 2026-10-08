import { describe, expect, it } from 'vitest';

import { faceMarkup, headClipId, headPath } from './face-markup';
import { PEOPLE, type PersonId } from './people';

const everyone = Object.keys(PEOPLE) as PersonId[];

describe('faceMarkup', () => {
  it('paints every person with site tokens only, never a raw colour', () => {
    for (const who of everyone) {
      const markup = faceMarkup(who, 'happy');
      expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(markup).toContain(`var(--quad-site-${PEOPLE[who].skin})`);
      expect(markup).toContain(`var(--quad-site-${PEOPLE[who].top})`);
    }
  });

  it('shades each head inside its own shape, defined once by id', () => {
    expect(faceMarkup('leo', 'happy')).toContain(`clip-path="url(#${headClipId('leo')})"`);
    expect(headPath('leo')).toMatch(/^M50 [\d.]+C.*Z$/);
    expect(headPath('maya')).not.toBe(headPath('abara'));
  });

  it('shows the mood: worried brows and mouth, an open laugh', () => {
    const happy = faceMarkup('leo', 'happy');
    expect(faceMarkup('leo', 'worried')).not.toBe(happy);
    expect(faceMarkup('maya', 'laugh')).toContain(`fill="var(--quad-site-blush)"/>`);
  });

  it('draws the details that tell people apart', () => {
    expect(faceMarkup('asha', 'happy')).toContain('<circle cx="41.5"');
    expect(faceMarkup('abara', 'happy')).toContain('<rect x="35.5"');
    expect(faceMarkup('daniel', 'happy')).toContain('M29 50Q30 75 50 76');
    expect(faceMarkup('haddad', 'happy')).toContain(`fill="var(--quad-site-hair-plum)"`);
  });

  it('puts a chosen background behind the face', () => {
    expect(faceMarkup('maya', 'laugh', 'var(--quad-site-navy)')).toMatch(
      /^<circle cx="50" cy="50" r="50" fill="var\(--quad-site-navy\)"\/>/,
    );
  });
});
