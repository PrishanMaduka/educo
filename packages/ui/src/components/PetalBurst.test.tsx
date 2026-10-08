import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PetalBurstProvider, usePetalBurst } from './PetalBurst';

function mockMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

function Celebrate({ at }: { at?: { x: number; y: number } }) {
  const { burst } = usePetalBurst();
  return (
    <button
      type="button"
      onClick={() => {
        burst(at);
      }}
    >
      Celebrate
    </button>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('PetalBurst', () => {
  it('renders nothing when the person prefers reduced motion', async () => {
    mockMotion(true);
    const user = userEvent.setup();
    const { container } = render(
      <PetalBurstProvider>
        <Celebrate />
      </PetalBurstProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Celebrate' }));
    expect(container.querySelector('[data-petals]')).toBeNull();
    expect(document.querySelectorAll('[data-petal]')).toHaveLength(0);
  });

  it('shows hidden petals in the four accent colours, then cleans up', async () => {
    mockMotion(false);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <PetalBurstProvider>
        <Celebrate at={{ x: 100, y: 50 }} />
      </PetalBurstProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Celebrate' }));
    const layer = container.querySelector('[data-petals]');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    const petals = container.querySelectorAll('[data-petal]');
    expect(petals.length).toBeGreaterThan(10);
    const html = layer?.innerHTML ?? '';
    for (const c of ['bg-c1', 'bg-c2', 'bg-c3', 'bg-c5']) expect(html).toContain(c);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.querySelector('[data-petals]')).toBeNull();
  });

  it('throws a helpful error outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Celebrate />)).toThrow(/PetalBurstProvider/);
    spy.mockRestore();
  });
});
