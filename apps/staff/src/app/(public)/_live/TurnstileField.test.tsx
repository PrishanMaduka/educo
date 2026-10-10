import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TurnstileField, type TurnstileHandle } from './TurnstileField';

import type { TurnstileApi, TurnstileRenderOptions } from './turnstile-loader';

const DUMMY = 'XXXX.DUMMY.TOKEN.XXXX';

const scripts = () =>
  document.querySelectorAll<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/"]');

/** A stand-in for Cloudflare's `window.turnstile`, recording each widget it renders. */
function fakeTurnstile() {
  const widgets: TurnstileRenderOptions[] = [];
  const api = {
    render: vi.fn<TurnstileApi['render']>((_container, options) => {
      widgets.push(options);
      return `widget-${String(widgets.length)}`;
    }),
    reset: vi.fn<TurnstileApi['reset']>(),
    remove: vi.fn<TurnstileApi['remove']>(),
  };
  return { api, widgets };
}

/** Plays Cloudflare's script finishing loading. */
async function scriptLoads(api: TurnstileApi): Promise<void> {
  window.turnstile = api;
  await act(async () => {
    window.quadTurnstileReady?.();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  for (const script of scripts()) script.remove();
  delete window.turnstile;
  delete window.quadTurnstileReady;
  document.documentElement.removeAttribute('data-theme');
  vi.resetModules();
});

describe('TurnstileField without a site key (a local build, D57)', () => {
  it('renders nothing, loads nothing and hands over the dummy token', async () => {
    const handle = createRef<TurnstileHandle>();
    const { container } = render(
      <TurnstileField ref={handle} setup={{ dummyToken: DUMMY }} active />,
    );
    expect(container).toBeEmptyDOMElement();
    await expect(handle.current?.token()).resolves.toBe(DUMMY);
    expect(scripts()).toHaveLength(0);
  });
});

describe('TurnstileField with a site key', () => {
  it('loads nothing until it is active, then renders the invisible widget', async () => {
    const { api, widgets } = fakeTurnstile();
    document.documentElement.setAttribute('data-theme', 'dark');
    const handle = createRef<TurnstileHandle>();
    const { rerender } = render(
      <TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active={false} />,
    );
    expect(scripts()).toHaveLength(0);

    rerender(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active />);
    expect(scripts()).toHaveLength(1);
    await scriptLoads(api);
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(widgets[0]).toMatchObject({
      sitekey: 'site-key',
      action: 'demo-request',
      appearance: 'interaction-only',
      theme: 'dark',
      'response-field': false,
      'refresh-expired': 'auto',
    });
  });

  it('follows the device theme when the page has no theme of its own', async () => {
    const { api, widgets } = fakeTurnstile();
    render(<TurnstileField setup={{ siteKey: 'site-key' }} active />);
    await scriptLoads(api);
    expect(widgets[0]?.theme).toBe('auto');
  });

  it('waits for the token, and after a reset waits for a fresh one', async () => {
    const { api, widgets } = fakeTurnstile();
    const handle = createRef<TurnstileHandle>();
    render(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active />);
    await scriptLoads(api);

    const first = handle.current?.token();
    widgets[0]?.callback('token-1');
    await expect(first).resolves.toBe('token-1');
    await expect(handle.current?.token()).resolves.toBe('token-1');

    handle.current?.reset();
    expect(api.reset).toHaveBeenCalledWith('widget-1');
    let second: string | undefined;
    void handle.current?.token().then((token) => (second = token));
    await Promise.resolve();
    expect(second).toBeUndefined();
    widgets[0]?.callback('token-2');
    await vi.waitFor(() => {
      expect(second).toBe('token-2');
    });
  });

  it('starts loading when a token is asked for before it is active', async () => {
    const { api, widgets } = fakeTurnstile();
    const handle = createRef<TurnstileHandle>();
    render(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active={false} />);
    const token = handle.current?.token();
    expect(scripts()).toHaveLength(1);
    await scriptLoads(api);
    widgets[0]?.callback('token-1');
    await expect(token).resolves.toBe('token-1');
  });

  it('keeps waiting through a widget error, so Turnstile’s own retry can still give a token', async () => {
    const { api, widgets } = fakeTurnstile();
    const handle = createRef<TurnstileHandle>();
    render(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active />);
    await scriptLoads(api);
    let settled: string | undefined;
    const token = handle.current?.token().then(
      (value) => (settled = value),
      () => (settled = 'rejected'),
    );
    widgets[0]?.['error-callback']('300030');
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBeUndefined();

    widgets[0]?.callback('token-after-retry');
    await token;
    expect(settled).toBe('token-after-retry');
  });

  it('gives up when no token comes within the wait, error or not', async () => {
    const { api, widgets } = fakeTurnstile();
    const handle = createRef<TurnstileHandle>();
    render(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active />);
    await scriptLoads(api);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const token = handle.current?.token();
      widgets[0]?.['error-callback']('300030');
      vi.advanceTimersByTime(60_000);
      await expect(token).rejects.toThrow(/in time/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops an expired token and waits for the next one', async () => {
    const { api, widgets } = fakeTurnstile();
    const handle = createRef<TurnstileHandle>();
    render(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active />);
    await scriptLoads(api);
    widgets[0]?.callback('token-1');
    widgets[0]?.['expired-callback']();
    let late: string | undefined;
    void handle.current
      ?.token()
      .then((value) => (late = value))
      .catch(() => undefined);
    await Promise.resolve();
    expect(late).toBeUndefined();
    widgets[0]?.callback('token-2');
    await vi.waitFor(() => {
      expect(late).toBe('token-2');
    });
  });

  it('refuses a token when Cloudflare’s script cannot load', async () => {
    const handle = createRef<TurnstileHandle>();
    render(<TurnstileField ref={handle} setup={{ siteKey: 'site-key' }} active />);
    const token = handle.current?.token();
    scripts()[0]?.dispatchEvent(new Event('error'));
    await expect(token).rejects.toThrow(/Turnstile/);
  });

  it('removes the widget when it goes away', async () => {
    const { api } = fakeTurnstile();
    const { unmount } = render(<TurnstileField setup={{ siteKey: 'site-key' }} active />);
    await scriptLoads(api);
    unmount();
    expect(api.remove).toHaveBeenCalledWith('widget-1');
  });
});
