import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';
import { Textarea } from './Textarea';

describe('Input', () => {
  it('labels the control and shows an error message linked to it', () => {
    render(<Input label="Guardian phone" error="Enter a phone number" />);
    const input = screen.getByLabelText('Guardian phone');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a phone number');
    expect(input).toHaveClass('border-bad');
  });

  it('puts an end control, such as Show password, inside the field after the input', () => {
    render(<Input label="Password" end={<button type="button">Show</button>} />);
    const input = screen.getByLabelText('Password');
    const show = screen.getByRole('button', { name: 'Show' });
    expect(input.parentElement).toContainElement(show);
    expect(input).toHaveClass('pr-16');
  });

  it('works without a visible label when given an aria-label', () => {
    render(<Input aria-label="Search students" />);
    expect(screen.getByRole('textbox', { name: 'Search students' })).toBeInTheDocument();
  });
});

describe('Textarea', () => {
  it('labels the control', () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });
});
