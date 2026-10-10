import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoAccess } from './NoAccess';

describe('NoAccess (spec 08; D52)', () => {
  it('names the role when the role is why the page is hidden', () => {
    render(<NoAccess page="fees" roleName="Teacher" home="my_teaching" hiddenBy="role" />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Fees & invoicing isn’t part of the Teacher role',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A school admin can change what the role can do/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My teaching' })).toHaveAttribute(
      'href',
      '/app/teaching',
    );
  });

  it('names the plan, not the role, when the school’s plan is why', () => {
    render(<NoAccess page="fees" roleName="School admin" home="dashboard" hiddenBy="plan" />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Fees & invoicing isn’t included in your school’s plan',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your school’s plan doesn’t include this. Ask Quad support if you’d like to add it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/School admin role/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/app');
  });

  it('reads as the role case when no reason is given', () => {
    render(<NoAccess page="fees" roleName="Teacher" home="my_teaching" />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Fees & invoicing isn’t part of the Teacher role',
      }),
    ).toBeInTheDocument();
  });
});
