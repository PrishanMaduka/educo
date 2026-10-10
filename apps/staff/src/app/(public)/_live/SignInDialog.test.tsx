import { fake, resetFake } from '@quad/config/vitest/fake-api';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInEntry } from '../_components/SignInEntry';

import { LiveSignIn, LiveSignInHost } from '.';

import type * as Api from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('@quad/config/vitest/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});

const comingSoon = {
  badge: 'Coming soon',
  title: 'Sign-in opens when schools go live',
  body: 'Book a demo meanwhile.',
  close: 'Close',
  bookDemo: 'Book a demo',
};

const CIS = {
  tenantId: '0190a000-0000-7000-8000-0000000000b1',
  name: 'Colombo International School',
  shortName: 'CIS',
  logoUrl: null,
  brand: {
    color: '#7A1F2B',
    light: {
      fill: '#7A1F2B',
      fillStrong: '#681A25',
      ink: '#FFFFFF',
      text: '#7A1F2B',
      soft: '#F1E1E3',
      railActive: '#7A1F2B',
      railActiveInk: '#FFFFFF',
    },
    dark: {
      fill: '#7A1F2B',
      fillStrong: '#681A25',
      ink: '#FFFFFF',
      text: '#D48A94',
      soft: '#3A1D24',
      railActive: '#7A1F2B',
      railActiveInk: '#FFFFFF',
    },
  },
  roleNames: ['Teacher'],
  suspended: false,
  suspendReason: null,
};
const KHA = {
  ...CIS,
  tenantId: '0190a000-0000-7000-8000-0000000000b2',
  name: 'Kandy Hill Academy',
  shortName: 'KHA',
  roleNames: ['Head of Mathematics'],
};

// The dialog is a lazy chunk. Vitest transforms its module graph (the whole M1 flow) on first
// import, which can take seconds under the full gate, so it is loaded once before the tests.
beforeAll(async () => {
  await import('./SignInDialog');
}, 30_000);

// jsdom has <dialog> but not its modal methods; these behave like the browser's for the test.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

const onOpen = vi.fn();

function renderLanding() {
  return render(
    <>
      <header>
        <LiveSignIn label="Sign in" />
      </header>
      <p>
        <LiveSignIn label="Sign in to your school" />
      </p>
      <LiveSignInHost onOpen={onOpen} />
    </>,
  );
}

/** The dialog once its lazy chunk has loaded and it has opened. */
async function openedDialog() {
  const dialog = await screen.findByRole('dialog', { name: 'Sign in to Quad' });
  await waitFor(() => {
    expect(dialog).toHaveAttribute('open');
  });
  return dialog;
}

// jsdom does not make the page behind a modal inert, so the steps are found inside the dialog.
async function passEmailAndPassword(dialog: HTMLElement, email = 'prishan@colombo-intl.lk') {
  const inDialog = within(dialog);
  await userEvent.type(await inDialog.findByLabelText('Work email'), email);
  await userEvent.click(inDialog.getByRole('button', { name: 'Continue' }));
  await userEvent.type(await inDialog.findByLabelText('Password'), 'a long passphrase');
  await userEvent.click(inDialog.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  resetFake();
  onOpen.mockReset();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('the sign-in dialog on the landing page', () => {
  it('opens a modal dialog labelled by its heading from a Sign in button', async () => {
    renderLanding();
    const opener = screen.getByRole('button', { name: 'Sign in' });
    expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
    // Nothing of the dialog is on the page until someone asks to sign in.
    expect(document.querySelector('[data-signin-dialog]')).toBeNull();

    await userEvent.click(opener);
    const dialog = await openedDialog();
    expect(dialog).toHaveAttribute('data-signin-dialog');
    expect(within(dialog).getByText('quad-edu.com')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Work email')).toHaveFocus();
  });

  it('signs in with email and password through POST /auth/password, then opens /app', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'done' } },
      'GET /api/v1/me': { status: 200, body: { school: { name: 'Colombo International School' } } },
    });
    renderLanding();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await passEmailAndPassword(await openedDialog());

    expect(
      await screen.findByRole('heading', { name: 'Opening Colombo International School…' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith('/app');
    });
    expect(fake.requests[0]).toMatchObject({
      key: 'POST /api/v1/auth/password',
      body: { email: 'prishan@colombo-intl.lk', password: 'a long passphrase' },
    });
  });

  it('lists the schools when the account has more than one', async () => {
    resetFake({
      'POST /api/v1/auth/password': { status: 200, body: { next: 'choose_school' } },
      'GET /api/v1/auth/memberships': { status: 200, body: { items: [CIS, KHA] } },
    });
    renderLanding();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in to your school' }));
    await passEmailAndPassword(await openedDialog(), 'ruwan@quad.local');

    expect(await screen.findByRole('heading', { name: 'Choose a school' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Colombo International School/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kandy Hill Academy/ })).toBeInTheDocument();
  });

  it('closes with Escape and returns focus to the button that opened it', async () => {
    renderLanding();
    const opener = screen.getByRole('button', { name: 'Sign in to your school' });
    await userEvent.click(opener);
    const dialog = await openedDialog();

    // The browser closes a modal dialog on Escape (its `cancel`, then `close`).
    act(() => {
      (dialog as HTMLDialogElement).close();
    });
    expect(dialog).not.toHaveAttribute('open');
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside the dialog, wrapping at both ends', async () => {
    renderLanding();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await openedDialog();
    const close = within(dialog).getByRole('button', { name: 'Close sign-in' });
    const cont = within(dialog).getByRole('button', { name: 'Continue' });

    cont.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(cont).toHaveFocus();
  });

  it('closes from the close button', async () => {
    renderLanding();
    const opener = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.click(opener);
    const dialog = await openedDialog();
    const close = within(dialog).getByRole('button', { name: 'Close sign-in' });
    // The close button submits the dialog's own form (method="dialog"), as the browser does.
    close.closest('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      (dialog as HTMLDialogElement).close();
    });
    await userEvent.click(close);
    expect(dialog).not.toHaveAttribute('open');
    expect(opener).toHaveFocus();
  });

  it('starts again at the email step when opened a second time', async () => {
    renderLanding();
    const opener = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.click(opener);
    let dialog = await openedDialog();
    await userEvent.type(within(dialog).getByLabelText('Work email'), 'a@b.lk');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByLabelText('Password')).toBeInTheDocument();
    act(() => {
      (dialog as HTMLDialogElement).close();
    });

    await userEvent.click(opener);
    dialog = await openedDialog();
    expect(within(dialog).getByLabelText('Work email')).toBeInTheDocument();
  });

  it('opens from /#signin on load, and drops the hash when closed', async () => {
    window.history.replaceState(null, '', '/#signin');
    renderLanding();
    const dialog = await openedDialog();

    act(() => {
      (dialog as HTMLDialogElement).close();
    });
    expect(window.location.hash).toBe('');
    // With no button to go back to, focus goes to the first Sign in on the page.
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
  });

  it('opens when the address changes to #signin', async () => {
    renderLanding();
    act(() => {
      window.history.replaceState(null, '', '/#signin');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await openedDialog()).toBeInTheDocument();
  });

  it('tells parents to use the Quad app, with coming-soon badges that link nowhere', async () => {
    renderLanding();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await openedDialog();
    expect(within(dialog).getByText('Parents: use the Quad app.')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'App Store, coming soon' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('img', { name: 'Google Play, coming soon' }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('link')).toBeNull();
    // The sign-in page's own parents sentence is replaced, not repeated.
    expect(
      within(dialog).queryByText('Parents and guardians sign in on the Quad parent app.'),
    ).toBeNull();
  });
});

describe('Sign in before launch (regression)', () => {
  it('still opens the coming-soon note and loads no sign-in dialog', async () => {
    render(<SignInEntry label="Sign in" look="nav" prelaunch comingSoon={comingSoon} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('dialog', { name: comingSoon.title })).toHaveAttribute('open');
    expect(document.querySelector('[data-signin-dialog]')).toBeNull();
  });
});
