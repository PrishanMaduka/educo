import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Drawer, type DrawerProps } from './Drawer';

function Harness(props: Partial<DrawerProps> & { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const { onClose, ...rest } = props;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open drawer
      </button>
      <Drawer
        title="Add a student"
        {...rest}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose?.();
        }}
      >
        <label>
          Name
          <input />
        </label>
      </Drawer>
    </>
  );
}

describe('Drawer', () => {
  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Add a student' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('focuses the first field when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('shows the title, subtitle and eyebrow', async () => {
    const user = userEvent.setup();
    render(<Harness subtitle="Fill in the basics" eyebrow="Students" />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByText('Fill in the basics')).toBeInTheDocument();
    expect(screen.getByText('Students')).toBeInTheDocument();
  });

  it('marks step 2 of 3 as the current step', async () => {
    const user = userEvent.setup();
    render(<Harness steps={['Details', 'Guardians', 'Review']} step={1} />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    const current = screen.getAllByRole('listitem').filter((li) => li.getAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('aria-current', 'step');
    expect(current[0]).toHaveTextContent('Guardians');
    expect(current[0]).toHaveTextContent('2');
  });

  it('is 520 px wide by default and 760 px when wide', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByRole('dialog').className).toContain('sm:w-[520px]');
    expect(screen.getByRole('dialog').className).toContain('w-full');
    unmount();
    render(<Harness width="wide" />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByRole('dialog').className).toContain('sm:w-[760px]');
  });

  it('asks before closing when there are unsaved changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness dirty onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes straight away when nothing changed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the footer and uses the bad accent for the danger tone', async () => {
    const user = userEvent.setup();
    render(<Harness tone="danger" footer={<button type="button">Suspend school</button>} />);
    await user.click(screen.getByRole('button', { name: 'Open drawer' }));
    expect(screen.getByRole('button', { name: 'Suspend school' })).toBeInTheDocument();
    expect(screen.getByRole('dialog').innerHTML).toContain('bad');
  });
});
