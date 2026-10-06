import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Select } from './Select';

const options = [
  { value: 'a', label: 'Class A' },
  { value: 'b', label: 'Class B' },
];

describe('Select', () => {
  it('renders a labelled Radix trigger showing the chosen option', () => {
    render(<Select label="Class" options={options} value="b" onValueChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveTextContent('Class B');
  });

  it('shows the placeholder when nothing is chosen', () => {
    render(
      <Select
        label="Class"
        options={options}
        onValueChange={() => {}}
        placeholder="Pick a class"
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveTextContent('Pick a class');
  });

  it('falls back to a native select', async () => {
    const onValueChange = vi.fn();
    render(
      <Select native label="Class" options={options} value="a" onValueChange={onValueChange} />,
    );
    const select = screen.getByLabelText('Class');
    expect(select.tagName).toBe('SELECT');
    await userEvent.selectOptions(select, 'b');
    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});
