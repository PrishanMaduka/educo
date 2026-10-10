import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { SignInEntry } from './SignInEntry';

const comingSoon = {
  badge: 'Coming soon',
  title: 'Sign-in opens when schools go live',
  body: 'Book a demo meanwhile.',
  close: 'Close',
  bookDemo: 'Book a demo',
};

// jsdom has <dialog> but not its modal methods; these behave like the browser's for the test.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

describe('SignInEntry before launch', () => {
  it('opens a labelled coming-soon note instead of signing in', async () => {
    render(<SignInEntry label="Sign in" look="nav" prelaunch comingSoon={comingSoon} />);
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = screen.getByRole('dialog', { name: comingSoon.title });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription(comingSoon.body);
    expect(screen.getByRole('link', { name: 'Book a demo' })).toHaveAttribute('href', '#demo');
  });

  it('closes from the close button and returns focus to Sign in', async () => {
    render(<SignInEntry label="Sign in" look="nav" prelaunch comingSoon={comingSoon} />);
    const opener = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    // The close button submits the dialog's own form (method="dialog"), as the browser does.
    screen
      .getByRole('button', { name: 'Close', hidden: true })
      .closest('form')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        (dialog as HTMLDialogElement).close();
      });
    await userEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(dialog).not.toHaveAttribute('open');
    expect(opener).toHaveFocus();
  });
});

describe('SignInEntry after launch', () => {
  it('is a button for the sign-in dialog and has no note', () => {
    render(<SignInEntry label="Sign in" look="link" prelaunch={false} comingSoon={comingSoon} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });
});
