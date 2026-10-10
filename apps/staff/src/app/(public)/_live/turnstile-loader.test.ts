import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Loader from './turnstile-loader';

const SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=quadTurnstileReady';

const fakeApi = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

const scripts = () =>
  document.querySelectorAll<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/"]');

// Each test starts with a fresh module, so nothing is loaded yet.
let loader: typeof Loader;
beforeEach(async () => {
  vi.resetModules();
  loader = await import('./turnstile-loader');
});

afterEach(() => {
  for (const script of scripts()) script.remove();
  delete window.turnstile;
  delete window.quadTurnstileReady;
});

describe('loadTurnstile (D57: Turnstile loads only when the visitor reaches the form)', () => {
  it('adds Cloudflare’s script once, for explicit rendering, and answers when it is ready', async () => {
    expect(scripts()).toHaveLength(0);
    const first = loader.loadTurnstile();
    const second = loader.loadTurnstile();
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]?.src).toBe(SCRIPT);
    expect(scripts()[0]?.async).toBe(true);

    window.turnstile = fakeApi;
    window.quadTurnstileReady?.();
    await expect(first).resolves.toBe(fakeApi);
    await expect(second).resolves.toBe(fakeApi);
    expect(scripts()).toHaveLength(1);
  });

  it('fails when the script cannot load, and tries again on the next call', async () => {
    const failed = loader.loadTurnstile();
    scripts()[0]?.dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow(/Turnstile/);
    expect(scripts()).toHaveLength(0);

    const again = loader.loadTurnstile();
    expect(scripts()).toHaveLength(1);
    window.turnstile = fakeApi;
    window.quadTurnstileReady?.();
    await expect(again).resolves.toBe(fakeApi);
  });
});
