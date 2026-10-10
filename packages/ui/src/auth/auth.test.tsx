import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthArt, AuthCard, AuthLayout, QrCode, ShowPasswordButton, StepError } from './index';

const labels = {
  show: 'Show',
  hide: 'Hide',
  showLabel: 'Show password',
  hideLabel: 'Hide password',
};

describe('AuthCard', () => {
  it('is a section named by its h1, and focuses the title when nothing else has focus', () => {
    render(<AuthCard title="Check your inbox" lede="A link is on its way." />);
    const title = screen.getByRole('heading', { level: 1, name: 'Check your inbox' });
    expect(screen.getByRole('region', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(title).toHaveFocus();
  });

  it('leaves focus on a field that took it', () => {
    render(
      <AuthCard title="Sign in to Quad">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the case under test */}
        <input aria-label="Email" autoFocus />
      </AuthCard>,
    );
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus();
  });
});

describe('ShowPasswordButton', () => {
  it('names itself for what it does next and reports the toggle', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ShowPasswordButton shown={false} onToggle={onToggle} labels={labels} />,
    );
    const button = screen.getByRole('button', { name: 'Show password' });
    expect(button).toHaveTextContent('Show');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<ShowPasswordButton shown onToggle={onToggle} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveTextContent('Hide');
  });
});

describe('StepError', () => {
  it('is an alert, so the error is read out when it appears', () => {
    render(<StepError>That code didn’t work.</StepError>);
    expect(screen.getByRole('alert')).toHaveTextContent('That code didn’t work.');
  });
});

describe('QrCode', () => {
  it('draws the text as a named image', () => {
    render(<QrCode text="otpauth://totp/Quad:a?secret=JBSWY3DPEHPK3PXP" label="QR code" />);
    const image = screen.getByRole('img', { name: 'QR code' });
    expect(image.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});

describe('AuthLayout and AuthArt', () => {
  it('puts the card in main with the foot line, and the product beside the logo', () => {
    render(
      <AuthLayout
        art={
          <AuthArt
            titleStart="Every school,"
            titleHighlight="looked after."
            body="From one place."
            product="Console"
          />
        }
        foot="Every sign-in is recorded."
      >
        <AuthCard title="Sign in to Quad" />
      </AuthLayout>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('Sign in to Quad');
    expect(main).toHaveTextContent('Every sign-in is recorded.');
    expect(screen.getByText('Console')).toBeInTheDocument();
    // No figures unless the app passes true ones.
    expect(screen.queryByRole('list')).toBeNull();
  });
});
