import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '../../../../../test/fake-api';

import { RecoveryCodes } from './RecoveryCodes';
import { SignInFlow, type SignInFlowProps } from './SignInFlow';

import type * as Api from '@/lib/api';

import { Providers as AuthProviders } from '@/components/Providers';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('../../../../../test/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});

const KHA = {
  tenantId: '0190a000-0000-7000-8000-0000000000b2',
  name: 'Kandy Hill Academy',
  shortName: 'KHA',
  logoUrl: null,
  brand: { color: '#1B7F53', fill: '#1B7F53', fillDark: '#2FA36E', ink: '#FFFFFF' },
  roleNames: ['Teacher'],
  suspended: false,
  suspendReason: null,
};
const CIS = {
  ...KHA,
  tenantId: '0190a000-0000-7000-8000-0000000000b1',
  name: 'Colombo International School',
  shortName: 'CIS',
  roleNames: ['Teacher', 'Head of Mathematics'],
};

const onOpen = vi.fn();

function renderFlow(props: Partial<SignInFlowProps> = {}) {
  return render(
    <AuthProviders>
      <SignInFlow lastSchool={null} next="/app" onOpen={onOpen} {...props} />
    </AuthProviders>,
  );
}

async function passEmailAndPassword(email = 'prishan@colombo-intl.lk') {
  await userEvent.type(screen.getByLabelText('Work email'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.type(await screen.findByLabelText('Password'), 'a long passphrase');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name });

beforeEach(() => {
  resetFake();
  onOpen.mockReset();
});

describe('SignInFlow', () => {
  it('signs in with email, password and the authenticator code, then opens the school', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'two_step' } },
      'POST /api/v1/auth/totp/verify': { status: 200, body: { next: 'done' } },
      'GET /api/v1/me': {
        status: 200,
        body: { school: { name: 'Colombo International School' } },
      },
    });
    renderFlow({ next: '/app/students' });
    expect(await heading('Sign in to Quad')).toBeInTheDocument();
    await passEmailAndPassword();

    expect(await heading('Two-step sign-in')).toBeInTheDocument();
    fireEvent.paste(screen.getByRole('textbox', { name: 'Digit 1 of 6' }), {
      clipboardData: { getData: () => '000000' },
    });

    expect(await heading('Opening Colombo International School…')).toBeInTheDocument();
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith('/app/students');
    });
    expect(fake.requests.map((request) => request.key)).toEqual([
      'POST /api/v1/auth/password',
      'POST /api/v1/auth/totp/verify',
      'GET /api/v1/me',
    ]);
    expect(fake.requests[0]?.body).toEqual({
      email: 'prishan@colombo-intl.lk',
      password: 'a long passphrase',
      keepSignedIn: true,
    });
    expect(fake.requests[1]).toMatchObject({
      body: { code: '000000', trustDevice: true },
      csrf: 'csrf-1',
    });
  });

  it('refuses an address that is not an email without asking the API', async () => {
    renderFlow();
    await userEvent.type(screen.getByLabelText('Work email'), 'prishan');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Work email')).toHaveAccessibleDescription(
      'Enter your work email, like name@yourschool.org.',
    );
    expect(fake.requests).toEqual([]);
  });

  it('says the email and password don’t match, with no hint about the account, and stays', async () => {
    resetFake({
      'POST /api/v1/auth/password': {
        status: 401,
        body: { code: 'invalid_credentials', message: 'from the API' },
      },
    });
    renderFlow();
    await passEmailAndPassword();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password don’t match. Check them and try again.',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back');
  });

  it('names the 15 minutes when the account is locked', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 403, body: { code: 'account_locked', message: 'x' } },
    });
    renderFlow();
    await passEmailAndPassword();
    expect(await screen.findByRole('alert')).toHaveTextContent(/locked for 15 minutes/);
  });

  it('shows the API’s field message for a validation answer', async () => {
    resetFake({
      'POST /api/v1/auth/password': {
        status: 400,
        body: {
          code: 'validation',
          message: 'x',
          fields: { password: 'That password is too long' },
        },
      },
    });
    renderFlow();
    await passEmailAndPassword();
    await waitFor(() => {
      expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
        'That password is too long',
      );
    });
  });

  it('lists the schools with their roles, and opens the one chosen, remembering it', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'choose_school' } },
      'GET /api/v1/auth/memberships': { status: 200, body: { items: [CIS, KHA] } },
      'POST /api/v1/auth/select-school': { status: 204 },
    });
    renderFlow();
    await passEmailAndPassword('ruwan@quad.local');
    expect(await heading('Choose a school')).toBeInTheDocument();
    expect(
      await screen.findByText('ruwan@quad.local is linked to 2 schools on Quad.', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText('Teacher · Head of Mathematics')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Remember my choice on this device' }),
    ).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /Kandy Hill Academy/ }));
    expect(await heading('Opening Kandy Hill Academy…')).toBeInTheDocument();
    expect(fake.requests.at(-1)).toMatchObject({
      key: 'POST /api/v1/auth/select-school',
      body: { tenantId: KHA.tenantId, remember: true },
    });
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith('/app');
    });
  });

  it('lists a paused school with its reason, and it cannot be opened', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'choose_school' } },
      'GET /api/v1/auth/memberships': {
        status: 200,
        body: { items: [{ ...KHA, suspended: true, suspendReason: 'Unpaid invoice' }, CIS] },
      },
    });
    renderFlow();
    await passEmailAndPassword();
    const paused = await screen.findByRole('button', { name: /Kandy Hill Academy/ });
    expect(paused).toBeDisabled();
    expect(paused).toHaveTextContent('Paused: Unpaid invoice');
  });

  it('sets up two-step when the chosen school asks for it', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'choose_school' } },
      'GET /api/v1/auth/memberships': { status: 200, body: { items: [CIS, KHA] } },
      'POST /api/v1/auth/select-school': {
        status: 403,
        body: { code: 'two_step_required', message: 'x' },
      },
      'POST /api/v1/me/totp': [
        {
          status: 200,
          body: {
            otpauthUri: 'otpauth://totp/Quad:ruwan?secret=JBSWY3DPEHPK3PXP&issuer=Quad',
            recoveryCodes: null,
            next: null,
          },
        },
        {
          status: 200,
          body: {
            otpauthUri: null,
            recoveryCodes: ['abcde-fghjk', 'mnpqr-stvwx'],
            next: 'choose_school',
          },
        },
      ],
    });
    renderFlow();
    await passEmailAndPassword();
    await userEvent.click(await screen.findByRole('button', { name: /Kandy Hill Academy/ }));

    expect(await heading('Turn on two-step sign-in')).toBeInTheDocument();
    expect(
      await screen.findByRole('img', { name: 'QR code to add Quad to your authenticator app' }),
    ).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();
    fireEvent.paste(screen.getByRole('textbox', { name: 'Digit 1 of 6' }), {
      clipboardData: { getData: () => '123456' },
    });

    expect(await heading('Save your recovery codes')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your recovery codes' })).toHaveTextContent(
      'abcde-fghjk',
    );
    await userEvent.click(screen.getByRole('button', { name: 'I’ve saved them, continue' }));
    expect(await heading('Choose a school')).toBeInTheDocument();
    expect(fake.requests.filter((request) => request.key === 'POST /api/v1/me/totp')).toEqual([
      { key: 'POST /api/v1/me/totp', body: {}, csrf: 'csrf-1' },
      { key: 'POST /api/v1/me/totp', body: { code: '123456' }, csrf: 'csrf-1' },
    ]);
  });

  it('tells a person with no school what to do', async () => {
    resetFake({ 'POST /api/v1/auth/password': { status: 200, body: { next: 'no_school' } } });
    renderFlow();
    await passEmailAndPassword();
    expect(await heading('No school yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This account isn’t linked to a school yet. Ask your school’s admin to invite you.',
      ),
    ).toBeInTheDocument();
  });

  it('sends a reset link and says Check your inbox the same way for any address', async () => {
    resetFake({ 'POST /api/v1/auth/password/forgot': { status: 202 } });
    renderFlow();
    await userEvent.type(screen.getByLabelText('Work email'), 'nobody@school.lk');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    expect(await heading('Reset your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveValue('nobody@school.lk');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    // The step has no field, so focus moves to its title instead of being lost.
    expect(await heading('Check your inbox')).toHaveFocus();
    expect(
      screen.getByText(
        'If nobody@school.lk has a Quad account, a reset link is on its way. It expires in 30 minutes.',
      ),
    ).toBeInTheDocument();
    expect(fake.requests[0]?.body).toEqual({ email: 'nobody@school.lk' });
  });

  it('welcomes back to the remembered school without choosing anything', () => {
    renderFlow({ lastSchool: 'Colombo International School' });
    expect(screen.getByText('Welcome back to Colombo International School')).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toHaveValue('');
    expect(fake.requests).toEqual([]);
  });

  it('says why when the portal sent the person back to set up two-step', () => {
    renderFlow({ notice: 'two_step' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'The school you chose asks for a two-step code. Sign in again to set it up.',
    );
    expect(screen.getByLabelText('Work email')).toHaveValue('');
  });

  it('shows no notice on an ordinary visit', () => {
    renderFlow();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('takes a recovery code instead of the app’s code', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'two_step' } },
      'POST /api/v1/auth/totp/verify': [
        { status: 400, body: { code: 'invalid_code', message: 'x' } },
        { status: 200, body: { next: 'choose_school' } },
      ],
      'GET /api/v1/auth/memberships': { status: 200, body: { items: [CIS, KHA] } },
    });
    renderFlow();
    await passEmailAndPassword();
    await userEvent.click(await screen.findByRole('button', { name: 'Use a recovery code' }));
    await userEvent.type(screen.getByLabelText('Recovery code'), 'wrong-codes');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code didn’t work.');
    await userEvent.clear(screen.getByLabelText('Recovery code'));
    await userEvent.type(screen.getByLabelText('Recovery code'), ' abcde-fghjk ');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await heading('Choose a school')).toBeInTheDocument();
    expect(fake.requests[2]?.body).toEqual({ recoveryCode: 'abcde-fghjk', trustDevice: true });
  });

  it('starts one authenticator only, even after the connection drops and comes back', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'two_step_setup' } },
      'POST /api/v1/me/totp': { status: 503, body: { code: 'unavailable', message: 'x' } },
    });
    renderFlow();
    await passEmailAndPassword();
    expect(await heading('Turn on two-step sign-in')).toBeInTheDocument();
    await waitFor(() => {
      expect(fake.requests.some((request) => request.key === 'POST /api/v1/me/totp')).toBe(true);
    });
    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests.filter((request) => request.key === 'POST /api/v1/me/totp')).toHaveLength(
      1,
    );
    focusManager.setFocused(undefined);
  });
});

describe('RecoveryCodes', () => {
  it('says so when the codes could not be copied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <AuthProviders>
        <RecoveryCodes codes={['abcde-fghjk']} onContinue={vi.fn()} />
      </AuthProviders>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy the codes' }));
    expect(await screen.findByText(/Couldn’t copy them/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('abcde-fghjk');
  });
});
