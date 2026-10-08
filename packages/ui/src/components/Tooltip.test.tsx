import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tabs } from './Tabs';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('describes its trigger on focus', async () => {
    render(
      <Tooltip content="Print the register">
        <button type="button">Print</button>
      </Tooltip>,
    );
    await userEvent.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Print the register');
  });
});

describe('Tabs', () => {
  const tabs = [
    { value: 'a', label: 'Overview', panel: <p>Overview body</p> },
    { value: 'b', label: 'Fees', count: 3, panel: <p>Fees body</p> },
  ];

  it('switches panels and keeps tab semantics', async () => {
    render(<Tabs label="Student" tabs={tabs} defaultValue="a" />);
    expect(screen.getByRole('tablist', { name: 'Student' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Overview body')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Fees/ }));
    expect(screen.getByText('Fees body')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fees/ })).toHaveTextContent('3');
  });
});
