import { colors, contrastRatio } from '@quad/tokens';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Segmented } from './Segmented';

const options = [
  { value: 'P', label: 'Present', tone: 'good' as const },
  { value: 'A', label: 'Absent', tone: 'bad' as const },
  { value: 'L', label: 'Late', tone: 'warn' as const, disabled: true },
];

describe('Segmented', () => {
  it('is a labelled radio group with the chosen option checked', () => {
    render(<Segmented label="Attendance" options={options} value="A" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Absent' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Absent' })).toHaveClass('bg-bad-soft', 'ring-bad');
    expect(screen.getByRole('radio', { name: 'Present' })).not.toBeChecked();
  });

  it('changes on click and arrow keys, skipping disabled options', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Attendance" options={options} value="P" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Absent' }));
    expect(onChange).toHaveBeenLastCalledWith('A');
    screen.getByRole('radio', { name: 'Present' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('A');
    await userEvent.click(screen.getByRole('radio', { name: 'Late' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('Segmented colours', () => {
  it('keeps text readable and the tone ring visible on every tone in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const set = colors[theme] as Record<string, string>;
      for (const tone of ['good', 'warn', 'bad', 'info']) {
        expect(
          contrastRatio(set.ink!, set[`${tone}-soft`]!),
          `text on ${tone} ${theme}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(set[tone]!, set[`${tone}-soft`]!),
          `ring on ${tone} ${theme}`,
        ).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(set['brand-ink']!, set['brand-fill']!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
