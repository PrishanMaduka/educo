import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActionMenu } from './ActionMenu';

describe('ActionMenu', () => {
  it('lists the actions, and a choice closes the menu, returns focus, then runs', async () => {
    const reset = vi.fn();
    render(
      <ActionMenu
        label="More actions for Nadeesha Jayasinghe"
        items={[
          { id: 'reset', label: 'Reset password', onSelect: reset },
          { id: 'deactivate', label: 'Deactivate', tone: 'danger', onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'More actions for Nadeesha Jayasinghe' });
    await userEvent.click(trigger);
    const menu = screen.getByRole('dialog', { name: 'More actions for Nadeesha Jayasinghe' });
    expect(menu).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() => {
      expect(reset).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('shows nothing to open when there are no actions', () => {
    render(<ActionMenu label="More actions" items={[]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
