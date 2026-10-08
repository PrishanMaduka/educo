import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows initials and the same colour on every render', () => {
    const { unmount } = render(<Avatar name="Amaya Perera" />);
    const first = screen.getByRole('img', { name: 'Amaya Perera' });
    expect(first).toHaveTextContent('AP');
    const className = first.className;
    unmount();
    render(<Avatar name="Amaya Perera" />);
    expect(screen.getByRole('img', { name: 'Amaya Perera' }).className).toBe(className);
  });

  it('supports sizes', () => {
    render(<Avatar name="Ruwan Mendis" size="lg" />);
    expect(screen.getByRole('img')).toHaveClass('size-[72px]');
  });
});
