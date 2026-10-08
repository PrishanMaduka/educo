import { render, screen } from '@testing-library/react';
import { Bell } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is named by its label and hides the icon from screen readers', () => {
    render(<IconButton icon={Bell} label="Open notifications" />);
    const button = screen.getByRole('button', { name: 'Open notifications' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
