import { describe, expect, it } from 'vitest';

import { refreshOutcome } from './refresh-rotation';

const DAY = 24 * 60 * 60 * 1000;
const CREATED = new Date('2026-10-09T03:30:00.000Z');
const facts = {
  currentGeneration: 3,
  presentedGeneration: 3,
  secretIsCurrent: true,
  issued: true,
  familyCreatedAt: CREATED,
  now: new Date(CREATED.getTime() + DAY),
};

describe('refreshOutcome (spec 05: rotating refresh families)', () => {
  it('rotates the current generation with its own secret', () => {
    expect(refreshOutcome(facts)).toBe('rotate');
  });

  it.each([0, 1, 2])(
    'treats an older generation (%i) the family issued as reuse: the family is revoked',
    (presentedGeneration) => {
      expect(refreshOutcome({ ...facts, presentedGeneration, secretIsCurrent: false })).toBe(
        'reuse',
      );
    },
  );

  it('refuses a token the family never issued, whatever its generation (no revocation)', () => {
    expect(refreshOutcome({ ...facts, presentedGeneration: 1, issued: false })).toBe('refuse');
    expect(refreshOutcome({ ...facts, issued: false })).toBe('refuse');
  });

  it('refuses a generation the family has not reached', () => {
    expect(refreshOutcome({ ...facts, presentedGeneration: 4, secretIsCurrent: false })).toBe(
      'refuse',
    );
  });

  it('refuses the current generation with another secret', () => {
    expect(refreshOutcome({ ...facts, secretIsCurrent: false })).toBe('refuse');
  });

  it.each([
    { age: 60 * DAY - 1, outcome: 'rotate' },
    { age: 60 * DAY, outcome: 'refuse' },
  ] as const)('a family $age ms old: $outcome (60 days from its creation)', ({ age, outcome }) => {
    expect(refreshOutcome({ ...facts, now: new Date(CREATED.getTime() + age) })).toBe(outcome);
  });

  it('refuses an older generation of an expired family instead of reporting reuse', () => {
    expect(
      refreshOutcome({
        ...facts,
        presentedGeneration: 1,
        now: new Date(CREATED.getTime() + 61 * DAY),
      }),
    ).toBe('refuse');
  });
});
