import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('is a labelled, four-row text box that takes typing', async () => {
    render(<Textarea label="Reason" hint="Shown in the audit log" />);
    const box = screen.getByRole('textbox', { name: 'Reason' });
    expect(box).toHaveAttribute('rows', '4');
    expect(box).toHaveAccessibleDescription('Shown in the audit log');
    await userEvent.type(box, 'Parent asked');
    expect(box).toHaveValue('Parent asked');
  });

  it('marks an error as invalid and describes it', () => {
    render(<Textarea label="Reason" error="Enter a reason" />);
    const box = screen.getByRole('textbox', { name: 'Reason' });
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Enter a reason');
    expect(box).toHaveClass('border-bad');
  });
});
