import { fake, resetFake } from '@quad/config/vitest/fake-api';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleShell } from '../shell/ConsoleShell';

import { ConsoleSession } from './ConsoleSession';

import type * as Api from '@/lib/api';

import { Providers } from '@/components/Providers';
import { openPage, replacePage } from '@/lib/navigate';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('@quad/config/vitest/fake-api');
  const client = actual.createConsoleApi('http://localhost:3001', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, consoleApi: () => client };
});
vi.mock('@/lib/navigate', () => ({ openPage: vi.fn(), replacePage: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/audit',
  useRouter: () => ({ push: vi.fn() }),
}));

const NORA = { id: '01926f00-0000-7000-8000-000000000301', name: 'Nora Lindqvist', role: 'owner' };

function renderGate() {
  return render(
    <Providers>
      <ConsoleSession>
        <ConsoleShell>
          <h1>Audit log</h1>
        </ConsoleShell>
      </ConsoleSession>
    </Providers>,
  );
}

beforeEach(() => {
  vi.mocked(openPage).mockClear();
  vi.mocked(replacePage).mockClear();
  window.history.replaceState(null, '', '/audit?actor=x');
});

describe('ConsoleSession (the browser-side gate, D50)', () => {
  it('shows the page in the shell with the real name and role once GET /platform/me answers', async () => {
    resetFake({ 'GET /api/v1/platform/me': { status: 200, body: NORA } });
    renderGate();
    expect(screen.getByRole('status')).toHaveTextContent('Checking that you’re signed in…');
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getAllByText('Nora Lindqvist').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platform owner').length).toBeGreaterThan(0);
    expect(replacePage).not.toHaveBeenCalled();
  });

  it('sends a signed-out visit to sign-in, coming back to this page, and never shows it', async () => {
    resetFake({
      'GET /api/v1/platform/me': {
        status: 401,
        body: { code: 'unauthenticated', message: 'Sign in' },
      },
    });
    renderGate();
    await vi.waitFor(() => {
      expect(replacePage).toHaveBeenCalledWith('/sign-in?next=%2Faudit%3Factor%3Dx');
    });
    expect(screen.queryByRole('heading', { name: 'Audit log' })).toBeNull();
    expect(
      fake.requests.filter((request) => request.key === 'GET /api/v1/platform/me'),
    ).toHaveLength(1);
  });

  it('offers Try again when the check itself fails', async () => {
    resetFake({
      'GET /api/v1/platform/me': [
        { status: 500, body: { code: 'internal', message: 'Oops' } },
        { status: 500, body: { code: 'internal', message: 'Oops' } },
        { status: 500, body: { code: 'internal', message: 'Oops' } },
        { status: 200, body: NORA },
      ],
    });
    renderGate();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Try again' }, { timeout: 8000 }),
    );
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(replacePage).not.toHaveBeenCalled();
  });
});

describe('ConsoleShell sign out', () => {
  it('signs out with the console CSRF header, then opens sign-in', async () => {
    resetFake({
      'GET /api/v1/platform/me': { status: 200, body: { ...NORA, role: 'support' } },
      'POST /api/v1/platform/auth/sign-out': { status: 204 },
    });
    renderGate();
    expect((await screen.findAllByText('Support')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]!);
    await vi.waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/sign-in');
    });
    const sent = fake.requests.find(
      (request) => request.key === 'POST /api/v1/platform/auth/sign-out',
    );
    expect(sent?.csrf).toBe('console-csrf');
  });
});
