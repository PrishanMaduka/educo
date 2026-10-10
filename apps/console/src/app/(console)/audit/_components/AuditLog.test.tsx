import { fake, resetFake } from '@quad/config/vitest/fake-api';
import { downloadBlob } from '@quad/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditLog } from './AuditLog';

import type * as Api from '@/lib/api';
import type * as Ui from '@quad/ui';

import { Providers } from '@/components/Providers';
import { ConsoleSession } from '@/components/session/ConsoleSession';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('@quad/config/vitest/fake-api');
  const client = actual.createConsoleApi('http://localhost:3001', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, consoleApi: () => client };
});
vi.mock('@/lib/navigate', () => ({ openPage: vi.fn(), replacePage: vi.fn() }));
vi.mock('@quad/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  downloadBlob: vi.fn(),
}));

const NORA = { id: '01926f00-0000-7000-8000-000000000301', name: 'Nora Lindqvist' };
const COLOMBO = {
  id: '01926f00-0000-7000-8000-000000000101',
  name: 'Colombo International School',
  shortName: 'CIS',
  status: 'active',
  brandColor: null,
};
const OPENED = {
  id: '01926f00-0000-7000-8000-00000000a001',
  at: new Date(Date.now() - 5 * 60_000).toISOString(),
  action: 'support_session.started',
  summary: 'Opened Colombo International School as school admin',
  actor: { type: 'quad', ...NORA },
  school: { id: COLOMBO.id, name: COLOMBO.name },
  viaSupport: false,
  target: { type: 'support_session', id: null },
  meta: { reason: 'Principal asked for help with fee reminders' },
  ip: '10.1.2.3',
};
const CHANGED = {
  id: '01926f00-0000-7000-8000-00000000a002',
  at: new Date(Date.now() - 2 * 60_000).toISOString(),
  action: 'settings.updated',
  summary: 'Changed School settings: address',
  actor: { type: 'quad', ...NORA },
  school: { id: COLOMBO.id, name: COLOMBO.name },
  viaSupport: true,
  target: { type: 'school', id: COLOMBO.id },
  meta: { fields: ['address'], support_session_id: '01926f00-0000-7000-8000-00000000b001' },
  ip: null,
};
const SIGNED_IN = {
  id: '01926f00-0000-7000-8000-00000000a003',
  at: new Date(Date.now() - 60 * 60_000).toISOString(),
  action: 'auth.sign_in',
  summary: 'Signed in to the console',
  actor: { type: 'system' },
  school: null,
  viaSupport: false,
  target: null,
  meta: {},
  ip: null,
};

function renderAudit(extra: Record<string, unknown> = {}) {
  resetFake({
    'GET /api/v1/platform/me': { status: 200, body: { ...NORA, role: 'readonly' } },
    'GET /api/v1/platform/audit': {
      status: 200,
      body: { items: [CHANGED, OPENED, SIGNED_IN], nextCursor: null },
    },
    'GET /api/v1/platform/audit/people': { status: 200, body: { items: [NORA] } },
    'GET /api/v1/platform/tenants': { status: 200, body: { items: [COLOMBO], nextCursor: null } },
    ...extra,
  });
  return render(
    <Providers>
      <ConsoleSession>
        <AuditLog />
      </ConsoleSession>
    </Providers>,
  );
}

const auditQueries = () =>
  fake.sent.filter((request) => request.key === 'GET /api/v1/platform/audit');

async function loadedTable() {
  const table = await screen.findByRole('table', { name: 'Audit log entries' });
  await within(table).findByText('Changed School settings: address');
  return table;
}

beforeEach(() => {
  vi.mocked(downloadBlob).mockClear();
});

describe('AuditLog (spec 07)', () => {
  it('tells the story, then lists when, who, what and the school, newest first', async () => {
    renderAudit();
    expect(await screen.findByRole('heading', { level: 1, name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByText(/across every school, newest first/)).toBeInTheDocument();
    const table = await loadedTable();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[2]?.textContent)).toEqual([
      'Changed School settings: address',
      'Opened Colombo International School as school admin',
      'Signed in to the console',
    ]);
    expect(within(rows[0]!).getByText('Nora Lindqvist')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Colombo International School')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('System')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Platform')).toBeInTheDocument();
  });

  it('filters by Quad staff, school, action and when, as query parameters', async () => {
    renderAudit();
    await loadedTable();
    await userEvent.click(screen.getByRole('button', { name: /^Quad staff/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Nora Lindqvist' }));
    await userEvent.click(screen.getByRole('button', { name: /^School/ }));
    await userEvent.click(await screen.findByRole('option', { name: COLOMBO.name }));
    await userEvent.click(screen.getByRole('button', { name: /^Action/ }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'Opened a school as school admin' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^When/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }));
    await vi.waitFor(() => {
      expect(auditQueries().at(-1)?.query).toMatchObject({
        actor: NORA.id,
        tenantId: COLOMBO.id,
        action: 'support_session.started',
      });
    });
    const from = auditQueries().at(-1)?.query.from ?? '';
    expect(from).toMatch(/Z$/);
    const days = (Date.now() - Date.parse(from)) / 86_400_000;
    expect(days).toBeGreaterThan(6);
    expect(days).toBeLessThanOrEqual(7);

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    await vi.waitFor(() => {
      expect(auditQueries().at(-1)?.query).toEqual({ limit: '50' });
    });
  });

  it('opens an entry in a drawer with what was recorded, and marks a support visit', async () => {
    renderAudit();
    const table = await loadedTable();
    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Open the details of Opened Colombo International School as school admin',
      }),
    );
    const drawer = await screen.findByRole('dialog', {
      name: 'Opened Colombo International School as school admin',
    });
    expect(within(drawer).getByText('Opened a school as school admin')).toBeInTheDocument();
    expect(within(drawer).getByText('10.1.2.3')).toBeInTheDocument();
    expect(within(drawer).getByText('reason')).toBeInTheDocument();
    expect(
      within(drawer).getByText('Principal asked for help with fee reminders'),
    ).toBeInTheDocument();
    expect(within(drawer).queryByText(/during a Quad support visit/)).toBeNull();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Back to the log' }));

    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Open the details of Changed School settings: address',
      }),
    );
    const visit = await screen.findByRole('dialog', { name: 'Changed School settings: address' });
    expect(within(visit).getByText(/during a Quad support visit/)).toBeInTheDocument();
    expect(within(visit).getByText('Not recorded')).toBeInTheDocument();
  });

  it('exports the filtered entries as CSV, then says so', async () => {
    renderAudit({
      'GET /api/v1/platform/audit': [
        { status: 200, body: { items: [CHANGED, OPENED, SIGNED_IN], nextCursor: null } },
        {
          status: 200,
          text: 'when,who\n',
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="quad-platform-audit-2026-10-10.csv"',
          },
        },
        { status: 200, body: { items: [CHANGED, OPENED, SIGNED_IN], nextCursor: null } },
      ],
    });
    await loadedTable();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Audit log exported')).toBeInTheDocument();
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0] ?? [];
    expect(name).toBe('quad-platform-audit-2026-10-10.csv');
    expect(await blob?.text()).toBe('when,who\n');
    expect(auditQueries()[1]).toMatchObject({ accept: 'text/csv', query: {} });
  });

  it('shows the API’s sentence when the export is too large', async () => {
    renderAudit({
      'GET /api/v1/platform/audit': [
        { status: 200, body: { items: [CHANGED], nextCursor: null } },
        {
          status: 422,
          body: {
            code: 'business_rule',
            message:
              'There are more than 10,000 entries to export. Choose a shorter date range and export again.',
          },
        },
      ],
    });
    await loadedTable();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/more than 10,000 entries/)).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
