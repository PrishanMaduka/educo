import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GetApp } from './GetApp';

const labels = {
  getApp: 'Get the Quad app',
  askSchool: 'Ask your school about Quad',
  note: 'Coming soon. The Quad app isn’t in the App Store or Google Play yet.',
};

describe('GetApp', () => {
  it('says the app is coming soon instead of linking to a store, and hides it again', async () => {
    render(<GetApp labels={labels} badges={null} />);
    const button = screen.getByRole('button', { name: /Get the Quad app/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(labels.note);
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('status').id);

    await userEvent.click(button);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('sends parents to the form to ask their school', () => {
    render(<GetApp labels={labels} badges={null} />);
    expect(screen.getByRole('link', { name: labels.askSchool })).toHaveAttribute('href', '#demo');
  });
});
