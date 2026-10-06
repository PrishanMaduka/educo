import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows a sentence and the next action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No messages yet"
        description="New messages show up here."
        action={<button type="button">Write a message</button>}
      />,
    );
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write a message' })).toBeInTheDocument();
  });
});
