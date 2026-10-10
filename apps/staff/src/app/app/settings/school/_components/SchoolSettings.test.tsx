import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '@quad/config/vitest/fake-api';

import { SchoolSettings, type SchoolSettingsProps } from './SchoolSettings';

import type * as Api from '@/lib/api';
import type { AuditEntry, AuditLog, AuditPeople, School } from '@quad/contracts';

import { Providers } from '@/components/Providers';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('@quad/config/vitest/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/school',
  useRouter: () => ({ push: vi.fn() }),
}));

const SCHOOL: School = {
  name: 'Colombo International School',
  shortName: 'CIS',
  officeEmail: null,
  officePhone: '+94112345678',
  address: null,
  timeZone: 'Asia/Colombo',
  smsSenderId: null,
  smsSenderStatus: null,
  branding: { color: '#0F766E', logoUrl: null },
  signIn: { twoStep: 'admins', passwordMinLength: 12, sessionHours: 8, ipAllowlist: [] },
  summary: {
    parts: [
      { code: 'ask_quad_on' },
      { code: 'quiet_hours', from: '18:00', until: '07:00', weekends: true },
    ],
    needs: [{ code: 'add_office_email' }],
  },
  etag: '"v1"',
};

const ID = (n: string) => `0190a000-0000-7000-8000-0000000002${n}`;
const PRISHAN = { type: 'member', id: ID('a1'), name: 'Prishan Maduka' } as const;

const entry = (n: string, change: Partial<AuditEntry>): AuditEntry => ({
  id: ID(n),
  at: '2026-10-09T03:00:00.000Z',
  action: 'auth.sign_in',
  summary: 'Signed in',
  actor: PRISHAN,
  viaSupport: false,
  target: null,
  meta: {},
  ip: '203.0.113.8',
  ...change,
});

const SUPPORT_CHANGE = entry('b1', {
  action: 'settings.updated',
  summary: 'Changed School settings: address',
  actor: { type: 'quad_support' },
  viaSupport: true,
  meta: { fields: ['address'], before: { address: null }, after: { address: 'Kandy' } },
  ip: null,
});
const SIGN_IN = entry('b2', {});
const LOG: AuditLog = { items: [SUPPORT_CHANGE, SIGN_IN], nextCursor: null };
const PEOPLE: AuditPeople = { items: [{ id: PRISHAN.id, name: PRISHAN.name }] };

const PROPS: SchoolSettingsProps = {
  initialTab: 'general',
  timeZone: 'Asia/Colombo',
  canEdit: true,
  canExport: false,
};

function renderPage(props: Partial<SchoolSettingsProps> = {}) {
  return render(
    <Providers>
      <SchoolSettings {...PROPS} {...props} />
    </Providers>,
  );
}

const requestsTo = (key: string) => fake.sent.filter((request) => request.key === key);

beforeEach(() => {
  resetFake({
    'GET /api/v1/school': { status: 200, body: SCHOOL },
    'GET /api/v1/audit': { status: 200, body: LOG },
    'GET /api/v1/audit/people': { status: 200, body: PEOPLE },
  });
  window.history.replaceState(null, '', '/app/settings/school');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('School settings: the story', () => {
  it('says the summary from the API, then what needs doing', async () => {
    renderPage();
    expect(
      await screen.findByText('Ask Quad is on. Quiet hours are 18:00–07:00 and weekends.'),
    ).toBeInTheDocument();
    const needs = screen.getByRole('region', { name: 'What needs doing' });
    expect(within(needs).getByText(/Add an office email, so replies/)).toBeInTheDocument();
    await userEvent.click(within(needs).getByRole('button', { name: 'Add an office email' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Office email')).toHaveFocus();
    });
  });

  it('offers no action on a need when the person cannot edit', async () => {
    renderPage({ canEdit: false });
    const needs = await screen.findByRole('region', { name: 'What needs doing' });
    expect(within(needs).queryByRole('button')).toBeNull();
  });
});

describe('School settings: General', () => {
  it('saves only what changed, with the version it read, and says so', async () => {
    fake.answers['PATCH /api/v1/school'] = {
      status: 200,
      body: { ...SCHOOL, address: '12 Example Road', etag: '"v2"' },
    };
    renderPage();
    const address = await screen.findByLabelText('Address');
    expect(screen.queryByRole('button', { name: 'Save school details' })).toBeNull();
    await userEvent.type(address, '12 Example Road');
    await userEvent.click(screen.getByRole('button', { name: 'Save school details' }));

    expect(await screen.findByText('School details saved')).toBeInTheDocument();
    const [patch] = requestsTo('PATCH /api/v1/school');
    expect(patch?.body).toEqual({ address: '12 Example Road' });
    expect(patch?.ifMatch).toBe('"v1"');
    expect(patch?.csrf).toBe('csrf-1');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save school details' })).toBeNull();
    });
    expect(screen.getByLabelText('Address')).toHaveValue('12 Example Road');
  });

  it('clears an emptied field with null, and checks fields with the contract first', async () => {
    fake.answers['GET /api/v1/school'] = {
      status: 200,
      body: { ...SCHOOL, officeEmail: 'office@colombo-intl.local' },
    };
    fake.answers['PATCH /api/v1/school'] = { status: 200, body: SCHOOL };
    renderPage();
    const email = await screen.findByLabelText('Office email');
    await userEvent.clear(email);
    await userEvent.type(email, 'office');
    await userEvent.click(screen.getByRole('button', { name: 'Save school details' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(requestsTo('PATCH /api/v1/school')).toHaveLength(0);

    await userEvent.clear(email);
    await userEvent.click(screen.getByRole('button', { name: 'Save school details' }));
    await waitFor(() => {
      expect(requestsTo('PATCH /api/v1/school')[0]?.body).toEqual({ officeEmail: null });
    });
  });

  it('shows the API’s message under the field it names', async () => {
    fake.answers['PATCH /api/v1/school'] = {
      status: 400,
      body: {
        code: 'validation',
        message: 'Check the highlighted fields',
        fields: { officePhone: 'Enter a Sri Lankan phone number' },
      },
    };
    renderPage();
    const phone = await screen.findByLabelText('Office phone');
    await userEvent.clear(phone);
    await userEvent.type(phone, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Save school details' }));
    expect(await screen.findByText('Enter a Sri Lankan phone number')).toBeInTheDocument();
    expect(screen.queryByText('School details saved')).toBeNull();
  });

  it('on 409 says why, reads the newer version, and keeps what was typed', async () => {
    fake.answers['GET /api/v1/school'] = [
      { status: 200, body: SCHOOL },
      { status: 200, body: { ...SCHOOL, name: 'Colombo International', etag: '"v2"' } },
    ];
    fake.answers['PATCH /api/v1/school'] = {
      status: 409,
      body: { code: 'stale_version', message: 'Someone else changed this. Check and save again.' },
    };
    renderPage();
    await userEvent.type(await screen.findByLabelText('Address'), 'Kandy');
    await userEvent.click(screen.getByRole('button', { name: 'Save school details' }));
    expect(
      await screen.findByText('Someone else changed this. Check and save again.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText('School name')).toHaveValue('Colombo International');
    });
    expect(screen.getByLabelText('Address')).toHaveValue('Kandy');
  });

  it('holds the page while there are unsaved changes, and Discard lets it go', async () => {
    renderPage();
    await userEvent.type(await screen.findByLabelText('Address'), 'Kandy');
    const held = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(held);
    expect(held.defaultPrevented).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByLabelText('Address')).toHaveValue('');
    const free = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
  });

  it('refuses to change tab while there are unsaved changes, and keeps them', async () => {
    renderPage();
    await userEvent.type(await screen.findByLabelText('Address'), 'Kandy');
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }));
    expect(await screen.findByText('Save or discard your changes first')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Address')).toHaveValue('Kandy');
    expect(window.location.search).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }));
    expect(screen.getByRole('tab', { name: 'Audit' })).toHaveAttribute('aria-selected', 'true');
  });

  it('is read-only without settings.edit', async () => {
    renderPage({ canEdit: false });
    expect(await screen.findByLabelText('School name')).toHaveAttribute('readonly');
    expect(screen.getByText(/Ask a school admin to change them/)).toBeInTheDocument();
  });

  it('shows the time zone, logo and colour as set by Quad', async () => {
    renderPage();
    const quad = await screen.findByRole('region', { name: 'Set by Quad' });
    expect(within(quad).getByText('Asia/Colombo')).toBeInTheDocument();
    expect(within(quad).getByText('#0F766E')).toBeInTheDocument();
    expect(within(quad).queryByRole('textbox')).toBeNull();
  });
});

describe('School settings: Sign-in', () => {
  it('lists the rules, read-only and managed by Quad', async () => {
    renderPage({ initialTab: 'sign-in' });
    expect(
      await screen.findByText('Managed by Quad. Ask support to change them.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Required for school admins')).toBeInTheDocument();
    expect(screen.getByText('At least 12 characters')).toBeInTheDocument();
    expect(screen.getByText('Signed out after 8 hours')).toBeInTheDocument();
    expect(screen.getByText('Any address')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('School settings: Audit', () => {
  const table = () => within(screen.getByRole('table', { name: 'Audit log entries' }));

  it('lists entries with readable lines, and marks Quad support', async () => {
    renderPage({ initialTab: 'audit' });
    expect(
      await table().findByRole('button', {
        name: 'Open the details of Changed School settings: address',
      }),
    ).toBeInTheDocument();
    const support = table().getByRole('row', { name: /Changed School settings/ });
    expect(within(support).getByText('Quad support')).toBeInTheDocument();
    const signIn = table().getByRole('row', { name: /Signed in/ });
    expect(within(signIn).getByText('Prishan Maduka')).toBeInTheDocument();
  });

  it('opens an entry in a drawer with what changed, and closes it', async () => {
    renderPage({ initialTab: 'audit' });
    const open = await table().findByRole('button', {
      name: 'Open the details of Changed School settings: address',
    });
    await userEvent.click(open);
    const drawer = await screen.findByRole('dialog', {
      name: 'Changed School settings: address',
    });
    expect(within(drawer).getByText(/Done by Quad support during a support visit/)).toBeVisible();
    const change = within(drawer).getByRole('row', { name: /Address/ });
    expect(within(change).getByText('None')).toBeInTheDocument();
    expect(within(change).getByText('Kandy')).toBeInTheDocument();
    expect(within(drawer).getByText('Not recorded')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Back to the log' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(open).toHaveFocus();
  });

  it('filters by action and person through the API', async () => {
    renderPage({ initialTab: 'audit' });
    await table().findByRole('row', { name: /Signed in/ });
    await userEvent.click(screen.getByRole('button', { name: /^Action/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Signed in' }));
    await waitFor(() => {
      expect(requestsTo('GET /api/v1/audit').at(-1)?.query).toMatchObject({
        action: 'auth.sign_in',
      });
    });
    await userEvent.click(screen.getByRole('button', { name: /^Person/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Prishan Maduka' }));
    await waitFor(() => {
      expect(requestsTo('GET /api/v1/audit').at(-1)?.query).toMatchObject({
        action: 'auth.sign_in',
        actor: PRISHAN.id,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(requestsTo('GET /api/v1/audit').at(-1)?.query).toEqual({ limit: '50' });
    });
  });

  it('keeps the filters when you leave the tab and come back', async () => {
    renderPage({ initialTab: 'audit' });
    await table().findByRole('row', { name: /Signed in/ });
    await userEvent.click(screen.getByRole('button', { name: /^Action/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Signed in' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Sign-in' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Audit' }));
    expect(await screen.findByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(fake.sent.filter((r) => r.key === 'GET /api/v1/audit').at(-1)?.query).toMatchObject({
      action: 'auth.sign_in',
    });
  });

  it('sends the date range as a UTC instant from the school’s midnight', async () => {
    renderPage({ initialTab: 'audit' });
    await table().findByRole('row', { name: /Signed in/ });
    await userEvent.click(screen.getByRole('button', { name: /^When/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }));
    await waitFor(() => {
      expect(requestsTo('GET /api/v1/audit').at(-1)?.query.from).toMatch(/T18:30:00\.000Z$/);
    });
  });

  it('offers Export CSV only with sensitive.export_data', async () => {
    renderPage({ initialTab: 'audit' });
    await table().findByRole('row', { name: /Signed in/ });
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('exports the filtered log as CSV, and says so', async () => {
    const createObjectURL = vi.fn(() => 'blob:audit');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const attached: boolean[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      attached.push(this.isConnected);
    });
    fake.answers['GET /api/v1/audit'] = [
      { status: 200, body: LOG },
      {
        status: 200,
        text: 'When (UTC),Who\n',
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="quad-audit-2026-10-09.csv"',
        },
      },
      { status: 200, body: LOG },
    ];
    renderPage({ initialTab: 'audit', canExport: true });
    await table().findByRole('row', { name: /Signed in/ });
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText('Audit log exported')).toBeInTheDocument();
    const exported = requestsTo('GET /api/v1/audit')[1];
    expect(exported?.accept).toBe('text/csv');
    expect(exported?.query).toEqual({});
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    // In the document when clicked (Firefox and older Safari ignore a detached link), then gone.
    expect(attached).toEqual([true]);
    expect(document.querySelector('a[download]')).toBeNull();
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:audit');
    });
  });

  it('treats an answer with no file as a failure', async () => {
    const createObjectURL = vi.fn(() => 'blob:audit');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    fake.answers['GET /api/v1/audit'] = [
      { status: 200, body: LOG },
      { status: 200, text: '', headers: { 'content-type': 'text/csv; charset=utf-8' } },
    ];
    renderPage({ initialTab: 'audit', canExport: true });
    await table().findByRole('row', { name: /Signed in/ });
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.queryByText('Audit log exported')).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('says why an export was refused', async () => {
    fake.answers['GET /api/v1/audit'] = [
      { status: 200, body: LOG },
      {
        status: 422,
        body: {
          code: 'business_rule',
          message:
            'There are more than 10,000 entries to export. Choose a shorter date range and export again.',
        },
      },
    ];
    renderPage({ initialTab: 'audit', canExport: true });
    await table().findByRole('row', { name: /Signed in/ });
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText(/more than 10,000 entries/)).toBeInTheDocument();
    expect(screen.queryByText('Audit log exported')).toBeNull();
  });
});
