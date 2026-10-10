import { fake, resetFake } from '@quad/config/vitest/fake-api';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsoleSignIn } from './ConsoleSignIn';

import type * as Api from '@/lib/api';

import { Providers } from '@/components/Providers';
import { openPage } from '@/lib/navigate';

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

const EMAIL = 'owner@quad.local';

function renderSignIn(next = '/audit?actor=a') {
  return render(
    <Providers>
      <ConsoleSignIn next={next} />
    </Providers>,
  );
}

async function enterCredentials(email = EMAIL, password = 'a-long-password') {
  await userEvent.type(screen.getByLabelText('Quad email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

const sentBodies = (key: string) =>
  fake.requests.filter((request) => request.key === key).map((request) => request.body);

beforeEach(() => {
  vi.mocked(openPage).mockClear();
});

describe('ConsoleSignIn (spec 05: email, password, then the authenticator, D37)', () => {
  it('signs in with the password and the authenticator code, then opens the page asked for', async () => {
    resetFake({
      'POST /api/v1/platform/auth/password': { status: 200, body: { next: 'two_step' } },
      'POST /api/v1/platform/auth/totp/verify': { status: 200, body: { next: 'done' } },
    });
    renderSignIn();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Quad' })).toBeInTheDocument();
    await enterCredentials();
    expect(sentBodies('POST /api/v1/platform/auth/password')).toEqual([
      { email: EMAIL, password: 'a-long-password' },
    ]);

    expect(await screen.findByRole('heading', { name: 'Two-step sign-in' })).toBeInTheDocument();
    expect(screen.getByText(/for owner@quad\.local/)).toBeInTheDocument();
    await userEvent.keyboard('000000');

    await vi.waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/audit?actor=a');
    });
    const verify = fake.requests.find((r) => r.key === 'POST /api/v1/platform/auth/totp/verify');
    expect(verify).toMatchObject({ body: { code: '000000' }, csrf: 'csrf-1' });
    expect(screen.getByRole('heading', { name: 'Opening the console…' })).toBeInTheDocument();
  });

  it('offers no Google, Microsoft or other single sign-on (D37)', () => {
    resetFake();
    renderSignIn();
    expect(screen.queryByText(/google|microsoft|workspace/i)).toBeNull();
  });

  it('checks the email and password in the page before asking the API', async () => {
    resetFake();
    renderSignIn();
    await enterCredentials('not-an-email', 'x');
    expect(
      screen.getByText('Enter your Quad email address, like name@quad-edu.com.'),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Quad email'));
    await userEvent.type(screen.getByLabelText('Quad email'), EMAIL);
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(fake.requests).toEqual([]);
  });

  it('says only that the email and password don’t match, never which', async () => {
    resetFake({
      'POST /api/v1/platform/auth/password': {
        status: 401,
        body: { code: 'invalid_credentials', message: 'No' },
      },
    });
    renderSignIn();
    await enterCredentials();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password don’t match. Check them and try again.',
    );
  });

  it('shows a wrong code’s error and empties the boxes for another try', async () => {
    resetFake({
      'POST /api/v1/platform/auth/password': { status: 200, body: { next: 'two_step' } },
      'POST /api/v1/platform/auth/totp/verify': {
        status: 401,
        body: { code: 'invalid_code', message: 'No' },
      },
    });
    renderSignIn();
    await enterCredentials();
    await screen.findByRole('heading', { name: 'Two-step sign-in' });
    await userEvent.keyboard('123456');
    expect(await screen.findByRole('alert')).toHaveTextContent('That code didn’t work.');
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('');
    expect(openPage).not.toHaveBeenCalled();
  });

  it('sets up the authenticator on a first sign-in: QR code and key, then the first code', async () => {
    resetFake({
      'POST /api/v1/platform/auth/password': { status: 200, body: { next: 'two_step_setup' } },
      'POST /api/v1/platform/auth/totp/setup': {
        status: 200,
        body: {
          secret: 'JBSWY3DPEHPK3PXP',
          otpauthUri: 'otpauth://totp/Quad:owner?secret=JBSWY3DPEHPK3PXP&issuer=Quad',
        },
      },
      'POST /api/v1/platform/auth/totp/verify': { status: 200, body: { next: 'done' } },
    });
    renderSignIn('/');
    await enterCredentials();
    expect(
      await screen.findByRole('heading', { name: 'Turn on two-step sign-in' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /QR code/ })).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Digit 1 of 6'));
    await userEvent.keyboard('000000');
    await vi.waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/');
    });
    expect(sentBodies('POST /api/v1/platform/auth/totp/setup')).toEqual([{}]);
  });

  it('goes back from the code to the email and password', async () => {
    resetFake({
      'POST /api/v1/platform/auth/password': { status: 200, body: { next: 'two_step' } },
    });
    renderSignIn();
    await enterCredentials();
    await screen.findByRole('heading', { name: 'Two-step sign-in' });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Quad email')).toHaveValue(EMAIL);
  });
});
