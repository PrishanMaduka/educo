import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '../../../../../test/fake-api';
import { AuthProviders } from '../../_components/AuthProviders';
import { InviteFlow } from '../invite/[token]/_components/InviteFlow';
import { ResetPassword } from '../reset/[token]/_components/ResetPassword';
import { SupportRedeem } from '../support/[token]/_components/SupportRedeem';

import type * as Api from '@/lib/api';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('../../../../../test/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});

const INVALID = { status: 400, body: { code: 'invalid_link', message: 'This link is not valid' } };
const TOKEN = 'eyJwIjoxfQ.sig';

const withProviders = (children: ReactNode) => render(<AuthProviders>{children}</AuthProviders>);
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

beforeEach(() => {
  resetFake();
});

describe('the reset link page', () => {
  it('changes the password with the link’s token, then asks to sign in', async () => {
    resetFake({ 'POST /api/v1/auth/password/reset': { status: 204 } });
    withProviders(<ResetPassword token={TOKEN} />);
    await userEvent.type(screen.getByLabelText('New password'), 'a brand new passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Change my password' }));
    expect(await heading('Your password is changed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(fake.requests[0]?.body).toEqual({ token: TOKEN, password: 'a brand new passphrase' });
  });

  it('says only that a refused link is not valid any more', async () => {
    resetFake({ 'POST /api/v1/auth/password/reset': INVALID });
    withProviders(<ResetPassword token={TOKEN} />);
    await userEvent.type(screen.getByLabelText('New password'), 'a brand new passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Change my password' }));
    expect(await heading('This link isn’t valid any more')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('keeps the form for a weak password, with the API’s reason on the field', async () => {
    resetFake({
      'POST /api/v1/auth/password/reset': {
        status: 400,
        body: {
          code: 'validation',
          message: 'x',
          fields: { password: 'Use at least 10 characters.' },
        },
      },
    });
    withProviders(<ResetPassword token={TOKEN} />);
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Change my password' }));
    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
        'Use at least 10 characters.',
      );
    });
  });
});

describe('the support link page', () => {
  it('redeems the link once and opens the portal', async () => {
    resetFake({ 'POST /api/v1/auth/support-session': { status: 200, body: { next: 'done' } } });
    const onOpen = vi.fn();
    withProviders(<SupportRedeem token={TOKEN} onOpen={onOpen} />);
    expect(await heading('Opening the school…')).toBeInTheDocument();
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith('/app');
    });
    expect(fake.requests).toEqual([
      { key: 'POST /api/v1/auth/support-session', body: { token: TOKEN }, csrf: 'csrf-1' },
    ]);
  });

  it('says a used or expired support link is not valid any more', async () => {
    resetFake({ 'POST /api/v1/auth/support-session': INVALID });
    withProviders(<SupportRedeem token={TOKEN} onOpen={vi.fn()} />);
    expect(await heading('This link isn’t valid any more')).toBeInTheDocument();
  });
});

describe('the invite link page', () => {
  const details = (needsPassword: boolean) => ({
    status: 200,
    body: { school: 'Kandy Hill Academy', emailMasked: 'n•••@kandyhill.lk', needsPassword },
  });

  it('lets a new account choose its password, then goes on to its next step', async () => {
    resetFake({
      [`GET /api/v1/auth/invites/${TOKEN}`]: details(true),
      [`POST /api/v1/auth/invites/${TOKEN}/accept`]: { status: 200, body: { next: 'no_school' } },
    });
    withProviders(<InviteFlow token={TOKEN} />);
    expect(await heading('Join Kandy Hill Academy on Quad')).toBeInTheDocument();
    expect(screen.getByText(/This invitation is for n•••@kandyhill.lk./)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Choose a password'), 'a long first passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Accept and set up my account' }));
    expect(await heading('No school yet')).toBeInTheDocument();
    expect(fake.requests[1]?.body).toEqual({ password: 'a long first passphrase' });
  });

  it('has an existing account sign in with the invite as a hint, then accepts', async () => {
    resetFake({
      [`GET /api/v1/auth/invites/${TOKEN}`]: details(false),
      'POST /api/v1/auth/password': { status: 200, body: { next: 'choose_school' } },
      [`POST /api/v1/auth/invites/${TOKEN}/accept`]: {
        status: 200,
        body: { next: 'choose_school' },
      },
      'GET /api/v1/auth/memberships': { status: 200, body: { items: [] } },
    });
    withProviders(<InviteFlow token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to accept' }));
    expect(await heading('Join Kandy Hill Academy on Quad')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Work email'), 'nadeesha@kandyhill.lk');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(await screen.findByLabelText('Password'), 'a long passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await heading('Choose a school')).toBeInTheDocument();
    expect(fake.requests.map((request) => request.key)).toEqual([
      `GET /api/v1/auth/invites/${TOKEN}`,
      'POST /api/v1/auth/password',
      `POST /api/v1/auth/invites/${TOKEN}/accept`,
      'GET /api/v1/auth/memberships',
    ]);
    expect(fake.requests[1]?.body).toMatchObject({ inviteToken: TOKEN });
    expect(fake.requests[2]).toMatchObject({ body: {}, csrf: 'csrf-1' });
  });

  it('says a refused invite link is not valid any more, naming no school', async () => {
    resetFake({ [`GET /api/v1/auth/invites/${TOKEN}`]: INVALID });
    withProviders(<InviteFlow token={TOKEN} />);
    expect(await heading('This link isn’t valid any more')).toBeInTheDocument();
    expect(screen.queryByText(/Kandy Hill/)).toBeNull();
  });

  it('explains an invitation meant for another account', async () => {
    resetFake({
      [`GET /api/v1/auth/invites/${TOKEN}`]: details(false),
      'POST /api/v1/auth/password': { status: 200, body: { next: 'done' } },
      [`POST /api/v1/auth/invites/${TOKEN}/accept`]: {
        status: 403,
        body: { code: 'forbidden', message: 'x' },
      },
    });
    withProviders(<InviteFlow token={TOKEN} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to accept' }));
    await userEvent.type(screen.getByLabelText('Work email'), 'someone@else.lk');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(await screen.findByLabelText('Password'), 'a long passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invitation is for a different account.',
    );
  });
});
