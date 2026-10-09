import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './Toast';

function Harness({ messages }: { messages: string[] }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        messages.forEach((m) => {
          toast.show(m);
        });
      }}
    >
      fire
    </button>
  );
}

function setup(messages: string[]) {
  render(
    <ToastProvider>
      <Harness messages={messages} />
    </ToastProvider>,
  );
  act(() => {
    screen.getByRole('button', { name: 'fire' }).click();
  });
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces politely from a labelled live region that exists before any toast', () => {
    render(
      <ToastProvider>
        <span />
      </ToastProvider>,
    );
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps only the 2 newest toasts', () => {
    setup(['one', 'two', 'three']);
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  it('shows a message once while it is already showing, and for the full time from the repeat', () => {
    setup(['Save first', 'Save first']);
    expect(screen.getAllByText('Save first')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(2000);
      screen.getByRole('button', { name: 'fire' }).click();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getAllByText('Save first')).toHaveLength(1);
  });

  it('removes each toast after 2.8 seconds', () => {
    setup(['saved']);
    act(() => {
      vi.advanceTimersByTime(2799);
    });
    expect(screen.getByText('saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText('saved')).not.toBeInTheDocument();
  });

  it('throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness messages={[]} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
