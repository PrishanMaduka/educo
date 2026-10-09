import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Tabs } from './Tabs';

const tabs = [
  { value: 'profile', label: 'Profile', panel: <p>Profile panel</p> },
  { value: 'access', label: 'Access', count: 3, panel: <p>Access panel</p> },
  { value: 'audit', label: 'Audit', disabled: true, panel: <p>Audit panel</p> },
];

describe('Tabs', () => {
  it('names the tab list and opens on the first tab', () => {
    render(<Tabs label="User sections" tabs={tabs} />);
    expect(screen.getByRole('tablist', { name: 'User sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Profile panel');
  });

  it('switches with a click or the arrow keys, skipping a disabled tab, and reports it', async () => {
    const onValueChange = vi.fn();
    render(<Tabs label="User sections" tabs={tabs} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /Access/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Access panel');
    expect(onValueChange).toHaveBeenLastCalledWith('access');
    expect(screen.getByRole('tab', { name: /Access/ })).toHaveTextContent('3');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Audit' })).toBeDisabled();
  });
});
