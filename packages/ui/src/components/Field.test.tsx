import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field } from './Field';

function renderField(props: { hint?: string; error?: string }) {
  return render(
    <Field label="School name" {...props}>
      {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} />}
    </Field>,
  );
}

describe('Field', () => {
  it('labels the control and describes it with the hint', () => {
    renderField({ hint: 'As parents see it' });
    expect(screen.getByRole('textbox', { name: 'School name' })).toHaveAccessibleDescription(
      'As parents see it',
    );
  });

  it('shows the error in place of the hint, and points only at what is on the page', () => {
    renderField({ hint: 'As parents see it', error: 'Enter the school’s name' });
    const input = screen.getByRole('textbox', { name: 'School name' });
    expect(input).toHaveAccessibleDescription('Enter the school’s name');
    expect(screen.queryByText('As parents see it')).toBeNull();
    for (const id of (input.getAttribute('aria-describedby') ?? '').split(' ')) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('describes nothing when there is no hint or error', () => {
    renderField({});
    expect(screen.getByRole('textbox', { name: 'School name' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });
});
