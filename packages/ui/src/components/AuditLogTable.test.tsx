import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { metaLines } from '../lib/meta-lines';

import { AuditLogTable } from './AuditLogTable';
import { MetaList } from './MetaList';

const entries = [
  {
    id: 'e1',
    at: '2026-10-10T08:50:00.000Z',
    summary: 'Opened Colombo as school admin',
    school: 'Colombo',
  },
  { id: 'e2', at: '2026-10-09T09:00:00.000Z', summary: 'Signed in', school: null },
];

const labels = {
  caption: 'Audit log entries',
  when: 'When',
  who: 'Who',
  what: 'What',
  open: (summary: string) => `Open the details of ${summary}`,
};

describe('AuditLogTable', () => {
  it('shows when, who, what and the extra column, and each line opens its entry', async () => {
    const onOpen = vi.fn();
    render(
      <AuditLogTable
        entries={entries}
        now={new Date('2026-10-10T09:00:00.000Z')}
        timeZone="UTC"
        onOpen={onOpen}
        who={() => <span>Nora</span>}
        extraColumns={[{ key: 'school', header: 'School', cell: (entry) => entry.school ?? '—' }]}
        labels={labels}
        empty={<p>Nothing yet</p>}
      />,
    );
    const table = screen.getByRole('table', { name: 'Audit log entries' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['When', 'Who', 'What', 'School']);
    expect(within(table).getByText('10 minutes ago')).toHaveAttribute(
      'datetime',
      '2026-10-10T08:50:00.000Z',
    );
    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Open the details of Opened Colombo as school admin',
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(entries[0]);
    // The phone list carries the extra column too.
    const list = screen.getByRole('list', { name: 'Audit log entries' });
    expect(within(list).getByText('Colombo')).toBeInTheDocument();
  });

  it('shows the empty state when there are no entries', () => {
    render(
      <AuditLogTable
        entries={[]}
        now={new Date()}
        timeZone="UTC"
        onOpen={vi.fn()}
        who={() => null}
        labels={labels}
        empty={<p>Nothing yet</p>}
      />,
    );
    expect(screen.getAllByText('Nothing yet').length).toBeGreaterThan(0);
  });
});

describe('metaLines and MetaList', () => {
  it('turns meta into text lines, leaving out the omitted keys', () => {
    expect(
      metaLines(
        { rows: 2, ok: true, reason: 'Fix fees', nested: { a: 1 }, skip: 'x' },
        new Set(['skip']),
      ),
    ).toEqual([
      { key: 'rows', value: '2' },
      { key: 'ok', value: 'true' },
      { key: 'reason', value: 'Fix fees' },
      { key: 'nested', value: '{"a":1}' },
    ]);
  });

  it('lists the lines under a named heading, and nothing when there are none', () => {
    const { rerender, container } = render(
      <MetaList title="Recorded details" lines={[{ key: 'reason', value: 'Fix fees' }]} />,
    );
    const section = screen.getByRole('region', { name: 'Recorded details' });
    expect(within(section).getByText('reason')).toBeInTheDocument();
    expect(within(section).getByText('Fix fees')).toBeInTheDocument();
    rerender(<MetaList title="Recorded details" lines={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
