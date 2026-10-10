import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '@quad/config/vitest/fake-api';

import { useShellActions } from './use-shell-actions';

import type * as Api from '@/lib/api';

import { Providers } from '@/components/Providers';
import { openPage } from '@/lib/navigate';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('@quad/config/vitest/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});
vi.mock('@/lib/navigate', () => ({ openPage: vi.fn() }));

const KANDY = '0190a000-0000-7000-8000-0000000000b2';
const TEACHER = '0190a000-0000-7000-8000-0000000000c1';

const renderActions = () => renderHook(() => useShellActions(), { wrapper: Providers });

beforeEach(() => {
  resetFake();
  vi.mocked(openPage).mockClear();
});

describe('useShellActions: Switch school', () => {
  it('sends the person to sign in again, with the two-step notice, when the school needs set-up', async () => {
    resetFake({
      'POST /api/v1/auth/select-school': {
        status: 403,
        body: { code: 'two_step_required', message: 'x' },
      },
    });
    const { result } = renderActions();
    act(() => {
      result.current.switchSchool.mutate(KANDY);
    });
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/sign-in?next=%2Fapp&notice=two_step');
    });
    expect(openPage).toHaveBeenCalledTimes(1);
  });
});

describe('useShellActions: View as', () => {
  it('reloads the portal with the fixed notice, not a toast, when the old preview ended but the new one failed', async () => {
    resetFake({
      'DELETE /api/v1/me/role-preview': { status: 204 },
      'GET /api/v1/users': { status: 500, body: { code: 'internal', message: 'x' } },
    });
    const { result } = renderActions();
    act(() => {
      result.current.startPreview.mutate({
        roleId: TEACHER,
        needsSample: true,
        previewing: true,
      });
    });
    // The reload carries the reason (a fixed notice); a toast now would vanish with the page.
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/app?notice=preview_failed');
    });
    expect(
      screen.queryByText('Something went wrong on our side. Try again in a moment.'),
    ).toBeNull();
    expect(fake.requests.map((request) => request.key)).toEqual([
      'DELETE /api/v1/me/role-preview',
      'GET /api/v1/users',
    ]);
  });

  it('reloads the portal with the fixed notice when the old preview ended but the new one was refused', async () => {
    resetFake({
      'DELETE /api/v1/me/role-preview': { status: 204 },
      'POST /api/v1/me/role-preview': { status: 403, body: { code: 'forbidden', message: 'x' } },
    });
    const { result } = renderActions();
    act(() => {
      result.current.startPreview.mutate({
        roleId: TEACHER,
        needsSample: false,
        previewing: true,
      });
    });
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/app?notice=preview_failed');
    });
  });

  it('stays on the page with the toast when no preview was on', async () => {
    resetFake({
      'POST /api/v1/me/role-preview': { status: 403, body: { code: 'forbidden', message: 'x' } },
    });
    const { result } = renderActions();
    act(() => {
      result.current.startPreview.mutate({
        roleId: TEACHER,
        needsSample: false,
        previewing: false,
      });
    });
    expect(
      await screen.findByText('You can’t open that school with this account.'),
    ).toBeInTheDocument();
    expect(openPage).not.toHaveBeenCalled();
  });

  it('stays on the page when ending the old preview itself failed, since it is still on', async () => {
    resetFake({
      'DELETE /api/v1/me/role-preview': { status: 500, body: { code: 'internal', message: 'x' } },
    });
    const { result } = renderActions();
    act(() => {
      result.current.startPreview.mutate({
        roleId: TEACHER,
        needsSample: false,
        previewing: true,
      });
    });
    expect(
      await screen.findByText('Something went wrong on our side. Try again in a moment.'),
    ).toBeInTheDocument();
    expect(openPage).not.toHaveBeenCalled();
  });
});
