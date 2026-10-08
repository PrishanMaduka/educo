import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';
import { Kpi } from './Kpi';

describe('Card', () => {
  it('names the section by its title and shows actions', () => {
    render(
      <Card title="Fees this term" actions={<button type="button">Export</button>}>
        Body
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Fees this term' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Fees this term' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});

describe('Kpi', () => {
  it('pairs a label with its value and delta', () => {
    render(
      <Kpi label="Present today" value="1,204" delta="+2% on last week" icon={Users} tone="good" />,
    );
    expect(screen.getByText('Present today')).toBeInTheDocument();
    expect(screen.getByText('1,204')).toBeInTheDocument();
    expect(screen.getByText('+2% on last week')).toBeInTheDocument();
  });
});
