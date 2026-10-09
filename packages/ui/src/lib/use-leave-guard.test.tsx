import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLeaveGuard } from './use-leave-guard';

function Page({ active }: { active: boolean }) {
  useLeaveGuard(active, 'Leave without saving?');
  return (
    <>
      <a href="/app/settings/users/roles/new">New role</a>
      <a href="https://example.com/help" target="_blank" rel="noreferrer">
        Help
      </a>
      <a href="#matrix">Skip to the matrix</a>
    </>
  );
}

/** Whether a click on the link went on to navigate (nothing cancelled it). */
function clickGoesThrough(name: string): boolean {
  return fireEvent.click(screen.getByRole('link', { name }));
}

function unloadIsHeld(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/** What an older browser reads to decide whether to ask (`returnValue` set by the page). */
function unloadReturnValue(): unknown {
  const event = new Event('beforeunload', { cancelable: true });
  Object.defineProperty(event, 'returnValue', { value: undefined, writable: true });
  window.dispatchEvent(event);
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return (event as Event & { returnValue: unknown }).returnValue;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLeaveGuard', () => {
  it('lets every link and a reload through while nothing is unsaved', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Page active={false} />);
    expect(clickGoesThrough('New role')).toBe(true);
    expect(unloadIsHeld()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before a link in the app leaves unsaved changes, and stays when the answer is no', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Page active />);
    expect(clickGoesThrough('New role')).toBe(false);
    expect(confirm).toHaveBeenCalledWith('Leave without saving?');
  });

  it('leaves when the answer is yes', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Page active />);
    expect(clickGoesThrough('New role')).toBe(true);
  });

  it('holds a reload or a closed tab, and leaves new tabs and links on the page alone', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Page active />);
    expect(unloadIsHeld()).toBe(true);
    expect(unloadReturnValue()).toBe('');
    expect(clickGoesThrough('Help')).toBe(true);
    expect(clickGoesThrough('Skip to the matrix')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('stops guarding once it is no longer needed', () => {
    const view = render(<Page active />);
    view.rerender(<Page active={false} />);
    expect(unloadIsHeld()).toBe(false);
  });
});
