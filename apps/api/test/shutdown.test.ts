import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createShutdown } from '../src/shutdown';

function setup(close: () => Promise<void>) {
  const exit = vi.fn<(code: number) => void>();
  const tracing = { enabled: true, shutdown: vi.fn(() => Promise.resolve()) };
  const stop = createShutdown('API', {
    logger: pino({ level: 'silent' }),
    close,
    tracing,
    exit,
  });
  return { exit, tracing, stop };
}

describe('createShutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes, flushes tracing and exits 0', async () => {
    const { exit, tracing, stop } = setup(() => Promise.resolve());
    await stop('SIGTERM');
    expect(tracing.shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('still flushes tracing and exits 1 when closing fails', async () => {
    const { exit, tracing, stop } = setup(() => Promise.reject(new Error('close failed')));
    await stop('SIGTERM');
    expect(tracing.shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces exit 1 after 25 s when closing hangs', async () => {
    const { exit, stop } = setup(() => new Promise<void>(() => undefined));
    void stop('SIGTERM');
    await vi.advanceTimersByTimeAsync(24_999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('flushes error reports for up to 2 s before tracing, even when closing fails', async () => {
    const order: string[] = [];
    const flush = vi.fn((timeoutMs: number) => {
      order.push(`flush ${timeoutMs}`);
      return Promise.resolve(true);
    });
    const exit = vi.fn<(code: number) => void>();
    const stop = createShutdown('Worker', {
      logger: pino({ level: 'silent' }),
      close: () => Promise.reject(new Error('close failed')),
      tracing: {
        enabled: true,
        shutdown: () => {
          order.push('tracing');
          return Promise.resolve();
        },
      },
      reporter: { capture: () => undefined, flush },
      exit,
    });
    await stop('SIGTERM');
    expect(order).toEqual(['flush 2000', 'tracing']);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('runs once even if a second signal arrives', async () => {
    const close = vi.fn(() => Promise.resolve());
    const { stop } = setup(close);
    await Promise.all([stop('SIGTERM'), stop('SIGINT')]);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
