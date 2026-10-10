import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { accessibleOnceStill, type SeriousViolation, type StillPage } from '../playwright/checks';

/*
 * `accessibleOnceStill` against a stand-in page whose functions run here, on a stubbed `document`:
 * the in-page motion watcher is the real code, and "axe" is a stub that can start a transition
 * while it runs, as the Invite staff button's fade did in staff journey 19.
 */

const CONTRAST: SeriousViolation = {
  id: 'color-contrast',
  help: 'Elements must meet minimum color contrast ratio thresholds',
  targets: ['.max-w-full'],
};

function stillPage(): StillPage & { waits: number } {
  const page = {
    waits: 0,
    waitForFunction: () => {
      page.waits += 1;
      return Promise.resolve();
    },
    evaluate: <R>(fn: () => R) => Promise.resolve(fn()),
  };
  return page;
}

beforeEach(() => {
  vi.stubGlobal('document', new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { __quadMotion?: unknown }).__quadMotion;
});

describe('accessibleOnceStill', () => {
  it('runs axe once on a still page and reports what it found', async () => {
    const page = stillPage();
    const analyze = vi.fn(() => Promise.resolve([]));
    await expect(accessibleOnceStill(page, analyze)).resolves.toEqual([]);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(page.waits).toBe(1);
  });

  it.each(['transitionstart', 'animationstart'])(
    'runs axe again once still when a %s fired during the first run',
    async (type) => {
      const page = stillPage();
      const analyze = vi
        .fn<() => Promise<SeriousViolation[]>>()
        .mockImplementationOnce(() => {
          // The roles arrive mid-analysis: the button starts fading in, axe reads it halfway.
          document.dispatchEvent(new Event(type));
          return Promise.resolve([CONTRAST]);
        })
        .mockResolvedValueOnce([]);
      await expect(accessibleOnceStill(page, analyze)).resolves.toEqual([]);
      expect(analyze).toHaveBeenCalledTimes(2);
      expect(page.waits).toBe(2);
    },
  );

  it('keeps a real problem found on a still page', async () => {
    const page = stillPage();
    const analyze = vi.fn(() => Promise.resolve([CONTRAST]));
    await expect(accessibleOnceStill(page, analyze)).resolves.toEqual([CONTRAST]);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('watches afresh on each call: motion before the call does not count', async () => {
    const page = stillPage();
    await accessibleOnceStill(page, () => {
      document.dispatchEvent(new Event('transitionstart'));
      return Promise.resolve([]);
    });
    document.dispatchEvent(new Event('transitionstart'));
    const analyze = vi.fn(() => Promise.resolve([]));
    await accessibleOnceStill(page, analyze);
    expect(analyze).toHaveBeenCalledTimes(1);
  });
});
