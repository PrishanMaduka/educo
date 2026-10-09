import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { OtpBoxes, type OtpBoxesProps } from './OtpBoxes';

const digitLabel = (position: number, count: number) => `Digit ${position} of ${count}`;

/** OtpBoxes with its value kept in state, as a page holds it. */
function Harness(props: Partial<OtpBoxesProps>) {
  const [value, setValue] = useState('');
  return (
    <OtpBoxes
      label="6-digit code"
      digitLabel={digitLabel}
      value={value}
      onChange={setValue}
      {...props}
    />
  );
}

const boxes = () => screen.getAllByRole('textbox');

describe('OtpBoxes', () => {
  it('shows six labelled numeric boxes in a named group, ready for one-time-code autofill', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: '6-digit code' })).toBeInTheDocument();
    expect(boxes()).toHaveLength(6);
    expect(screen.getByRole('textbox', { name: 'Digit 1 of 6' })).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
    for (const box of boxes()) expect(box).toHaveAttribute('inputmode', 'numeric');
  });

  it('moves to the next box as each digit is typed, and calls onComplete with all six', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(boxes()[0] as HTMLElement);
    await userEvent.keyboard('12');
    expect(boxes()[2]).toHaveFocus();
    await userEvent.keyboard('3456');
    expect(boxes().map((box) => (box as HTMLInputElement).value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('ignores anything but digits', async () => {
    render(<Harness />);
    await userEvent.click(boxes()[0] as HTMLElement);
    await userEvent.keyboard('a-');
    expect(boxes()[0]).toHaveValue('');
    expect(boxes()[0]).toHaveFocus();
  });

  it('fills every box from a pasted code, spaces and dashes dropped, and completes', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0] as HTMLElement, {
      clipboardData: { getData: () => ' 123-456 ' },
    });
    expect(
      boxes()
        .map((box) => (box as HTMLInputElement).value)
        .join(''),
    ).toBe('123456');
    expect(boxes()[5]).toHaveFocus();
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('fills from the box pasted into, and stops at the last box', () => {
    const onChange = vi.fn();
    render(<OtpBoxes label="Code" digitLabel={digitLabel} value="12" onChange={onChange} />);
    fireEvent.paste(boxes()[2] as HTMLElement, {
      clipboardData: { getData: () => '3456789' },
    });
    expect(onChange).toHaveBeenLastCalledWith('123456');
  });

  it('takes a whole code that autofill puts in one box', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0] as HTMLElement, { target: { value: '654321' } });
    expect(onComplete).toHaveBeenCalledWith('654321');
  });

  it('goes back a box on Backspace in an empty box, clearing that digit', async () => {
    render(<Harness />);
    await userEvent.click(boxes()[0] as HTMLElement);
    await userEvent.keyboard('12');
    await userEvent.keyboard('{Backspace}');
    expect(boxes()[1]).toHaveFocus();
    expect(boxes()[1]).toHaveValue('');
    expect(boxes()[0]).toHaveValue('1');
  });

  it('marks every box invalid and describes them with the error', () => {
    render(<Harness error="That code didn’t work." />);
    for (const box of boxes()) {
      expect(box).toBeInvalid();
      expect(box).toHaveAccessibleDescription('That code didn’t work.');
    }
  });
});
