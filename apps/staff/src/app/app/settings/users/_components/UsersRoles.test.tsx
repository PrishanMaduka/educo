import { useQueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '../../../../../../test/fake-api';

import { UsersRoles, type UsersRolesProps } from './UsersRoles';

import type * as Api from '@/lib/api';
import type { Role, RoleList, StaffList, StaffMember } from '@quad/contracts';

import { Providers } from '@/components/Providers';
import { openPage } from '@/lib/navigate';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('../../../../../../test/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});
vi.mock('@/lib/navigate', () => ({ openPage: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/users',
  useRouter: () => ({ push: vi.fn() }),
}));

const NONE = { view: false, create: false, edit: false, delete: false, approve: false };
const VIEW = { ...NONE, view: true };
const WORK = { ...VIEW, create: true, edit: true };
const ALL = { view: true, create: true, edit: true, delete: true, approve: true };
const matrixOf = (rows: Partial<Role['matrix']>): Role['matrix'] => ({
  admissions: NONE,
  crm: NONE,
  sis: NONE,
  attendance: NONE,
  lms: NONE,
  fees: NONE,
  finance: NONE,
  transport: NONE,
  settings: NONE,
  ...rows,
});

const role = (id: string, change: Partial<Role>): Role => ({
  id: `0190a000-0000-7000-8000-0000000000${id}`,
  key: id,
  name: id,
  description: null,
  color: null,
  system: true,
  scope: 'school',
  baseRoleKey: null,
  memberCount: 1,
  pageCount: 4,
  home: 'dashboard',
  matrix: matrixOf({}),
  sensitive: [],
  ...change,
});

const ADMIN = role('a1', {
  key: 'admin',
  name: 'School admin',
  pageCount: 24,
  matrix: matrixOf({ settings: ALL, fees: ALL }),
  sensitive: ['safeguarding', 'medical', 'finance_reports', 'export_data'],
});
const TEACHER = role('a2', {
  key: 'teacher',
  name: 'Teacher',
  scope: 'own_classes',
  home: 'my_teaching',
  pageCount: 9,
  matrix: matrixOf({ sis: VIEW, lms: WORK }),
});
const BURSAR = role('a3', {
  key: 'custom_1',
  name: 'Bursar',
  system: false,
  memberCount: 0,
  matrix: matrixOf({ fees: VIEW }),
});
const ROLES: RoleList = {
  items: [ADMIN, TEACHER, BURSAR],
  nextCursor: null,
  outsidePlan: ['transport'],
};

const member = (id: string, change: Partial<StaffMember>): StaffMember => ({
  id: `0190a000-0000-7000-8000-0000000001${id}`,
  name: id,
  email: `${id}@colombo-intl.local`,
  status: 'active',
  role: { id: TEACHER.id, name: 'Teacher' },
  twoStepOn: true,
  lastSignInAt: '2026-10-09T05:50:00.000Z',
  inviteSentAt: null,
  you: false,
  ...change,
});

const PRISHAN = member('b1', {
  name: 'Prishan Maduka',
  role: { id: ADMIN.id, name: 'School admin' },
  you: true,
});
const NADEESHA = member('b2', { name: 'Nadeesha Jayasinghe', twoStepOn: false });
const AMAYA = member('b3', {
  name: 'Amaya Perera',
  status: 'invited',
  twoStepOn: false,
  lastSignInAt: null,
  inviteSentAt: '2026-10-07T06:00:00.000Z',
});
const STAFF: StaffList = {
  items: [AMAYA, NADEESHA, PRISHAN],
  nextCursor: null,
  summary: { staff: 3, withoutTwoStep: 1 },
};

const PROPS: UsersRolesProps = {
  initialTab: 'people',
  initialRoleId: null,
  timeZone: 'Asia/Colombo',
  held: ['safeguarding', 'medical', 'finance_reports', 'export_data'],
  canPreview: true,
};

/** Reads the roles again, as another tab's save or a window focus would. */
function ReadRolesAgain() {
  const queries = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => {
        void queries.invalidateQueries({ queryKey: ['roles'] });
      }}
    >
      Read roles again
    </button>
  );
}

function renderPage(props: Partial<UsersRolesProps> = {}) {
  return render(
    <Providers>
      <UsersRoles {...PROPS} {...props} />
      <ReadRolesAgain />
    </Providers>,
  );
}

const table = () => within(screen.getByRole('table', { name: 'Staff accounts' }));
const rowOf = (name: string) => table().getByRole('row', { name: new RegExp(name) });

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetFake({
    'GET /api/v1/users': { status: 200, body: STAFF },
    'GET /api/v1/roles': { status: 200, body: ROLES },
  });
  vi.mocked(openPage).mockClear();
  window.history.replaceState(null, '', '/app/settings/users');
});

describe('Users & roles: People', () => {
  it('tells the story from the API, then lists the staff', async () => {
    renderPage();
    expect(
      await screen.findByText('3 staff · 1 hasn’t turned on two-step sign-in'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Staff accounts' })).toBeInTheDocument();
    expect(within(rowOf('Amaya Perera')).getByText('Invited')).toBeInTheDocument();
    expect(within(rowOf('Amaya Perera')).getByText(/^Invite sent/)).toBeInTheDocument();
  });

  it('locks your own row: no role change and no actions, just "You"', async () => {
    renderPage();
    const mine = await waitFor(() => rowOf('Prishan Maduka'));
    expect(within(mine).getByRole('combobox', { name: 'Role for Prishan Maduka' })).toBeDisabled();
    expect(within(mine).getByText('You')).toBeInTheDocument();
    expect(within(mine).queryByRole('button', { name: /More actions/ })).toBeNull();
  });

  it('offers Remind only to an active member without two-step, and confirms it', async () => {
    resetFake({
      ...fake.answers,
      [`POST /api/v1/users/${NADEESHA.id}/remind-two-step`]: { status: 202 },
    });
    renderPage();
    const row = await waitFor(() => rowOf('Nadeesha Jayasinghe'));
    expect(within(rowOf('Amaya Perera')).queryByRole('button', { name: /^Remind/ })).toBeNull();
    await userEvent.click(
      within(row).getByRole('button', {
        name: 'Remind Nadeesha Jayasinghe to turn on two-step sign-in',
      }),
    );
    expect(
      await screen.findByText('Reminder sent to Nadeesha Jayasinghe to turn on two-step sign-in'),
    ).toBeInTheDocument();
  });

  it('never offers "Sign in as" (spec 08)', async () => {
    renderPage();
    const row = await waitFor(() => rowOf('Nadeesha Jayasinghe'));
    await userEvent.click(
      within(row).getByRole('button', { name: 'More actions for Nadeesha Jayasinghe' }),
    );
    const menu = screen.getByRole('dialog', { name: 'More actions for Nadeesha Jayasinghe' });
    expect(
      within(menu)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Reset password', 'Sign out everywhere', 'Deactivate']);
    expect(screen.queryByText(/Sign in as/)).toBeNull();
  });

  it('deactivates only after the confirmation, then confirms what happened', async () => {
    resetFake({
      ...fake.answers,
      [`PATCH /api/v1/users/${NADEESHA.id}`]: {
        status: 200,
        body: { ...NADEESHA, status: 'deactivated' },
      },
    });
    renderPage();
    const row = await waitFor(() => rowOf('Nadeesha Jayasinghe'));
    await userEvent.click(
      within(row).getByRole('button', { name: 'More actions for Nadeesha Jayasinghe' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const drawer = await screen.findByRole('dialog', { name: 'Deactivate Nadeesha Jayasinghe?' });
    expect(fake.requests.some((request) => request.key.startsWith('PATCH'))).toBe(false);
    fake.answers['GET /api/v1/users'] = {
      status: 200,
      body: {
        ...STAFF,
        items: [AMAYA, { ...NADEESHA, status: 'deactivated' }, PRISHAN],
      },
    };
    await userEvent.click(
      within(drawer).getByRole('button', { name: 'Deactivate Nadeesha Jayasinghe' }),
    );
    // The menu button went with the row's old actions: focus moves to Reactivate, not the page.
    await waitFor(() => {
      expect(
        within(rowOf('Nadeesha Jayasinghe')).getByRole('button', { name: 'Reactivate' }),
      ).toHaveFocus();
    });
    expect(
      await screen.findByText('Nadeesha Jayasinghe can no longer sign in'),
    ).toBeInTheDocument();
    expect(fake.requests).toContainEqual({
      key: `PATCH /api/v1/users/${NADEESHA.id}`,
      body: { status: 'deactivated' },
      csrf: 'csrf-1',
    });
  });

  it('shows the API’s own sentence when a change is refused', async () => {
    resetFake({
      ...fake.answers,
      [`POST /api/v1/users/${AMAYA.id}/resend-invite`]: {
        status: 422,
        body: { code: 'business_rule', message: 'Only a pending invitation can be sent again.' },
      },
    });
    renderPage();
    const row = await waitFor(() => rowOf('Amaya Perera'));
    await userEvent.click(within(row).getByRole('button', { name: 'Resend invite' }));
    expect(
      await screen.findByText('Only a pending invitation can be sent again.'),
    ).toBeInTheDocument();
  });
});

describe('Users & roles: Invite staff', () => {
  async function openInvite() {
    renderPage();
    await screen.findByRole('table', { name: 'Staff accounts' });
    await userEvent.click(screen.getByRole('button', { name: 'Invite staff' }));
    return screen.findByRole('dialog', { name: 'Invite staff' });
  }

  it('invites several people with one role and says how many', async () => {
    resetFake({
      ...fake.answers,
      'POST /api/v1/users/invite': { status: 201, body: { items: [AMAYA, NADEESHA] } },
    });
    const drawer = await openInvite();
    await userEvent.type(
      within(drawer).getByLabelText('Email addresses'),
      'a.one@colombo-intl.local,\nb.two@colombo-intl.local',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send invites' }));
    expect(await screen.findByText('Invite sent to 2 people')).toBeInTheDocument();
    expect(fake.requests).toContainEqual({
      key: 'POST /api/v1/users/invite',
      body: {
        emails: ['a.one@colombo-intl.local', 'b.two@colombo-intl.local'],
        roleId: TEACHER.id,
      },
      csrf: 'csrf-1',
    });
  });

  it('checks the addresses with the contract before sending', async () => {
    const drawer = await openInvite();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send invites' }));
    expect(await within(drawer).findByText('Add at least one email address')).toBeInTheDocument();
    await userEvent.type(within(drawer).getByLabelText('Email addresses'), 'ok@x.lk not-an-email');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send invites' }));
    expect(
      await within(drawer).findByText('not-an-email: Enter a valid email address'),
    ).toBeInTheDocument();
    expect(fake.requests.some((request) => request.key === 'POST /api/v1/users/invite')).toBe(
      false,
    );
  });

  it('names every address the contract refuses, not just the first', async () => {
    const drawer = await openInvite();
    await userEvent.type(
      within(drawer).getByLabelText('Email addresses'),
      'first-bad ok@x.lk second-bad',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send invites' }));
    expect(
      await within(drawer).findByText(
        'first-bad: Enter a valid email address second-bad: Enter a valid email address',
      ),
    ).toBeInTheDocument();
  });

  it('still asks before closing after the school refuses the invite', async () => {
    resetFake({
      ...fake.answers,
      'POST /api/v1/users/invite': {
        status: 409,
        body: { code: 'already_member', message: 'This person is already a member of staff here.' },
      },
    });
    const drawer = await openInvite();
    await userEvent.type(
      within(drawer).getByLabelText('Email addresses'),
      'old@colombo-intl.local',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send invites' }));
    expect(
      await within(drawer).findByText('This person is already a member of staff here.'),
    ).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
  });

  it('names each address the school refuses', async () => {
    resetFake({
      ...fake.answers,
      'POST /api/v1/users/invite': {
        status: 422,
        body: {
          code: 'already_member',
          message: 'This person is already a member of staff here.',
          fields: { 'emails.1': 'This person is already a member of staff here.' },
        },
      },
    });
    const drawer = await openInvite();
    await userEvent.type(
      within(drawer).getByLabelText('Email addresses'),
      'new@colombo-intl.local old@colombo-intl.local',
    );
    await userEvent.click(within(drawer).getByRole('button', { name: 'Send invites' }));
    expect(
      await within(drawer).findByText(
        'old@colombo-intl.local: This person is already a member of staff here.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Users & roles: Roles & permissions', () => {
  it('locks a built-in role and shows modules outside the plan as Not in plan', async () => {
    renderPage({ initialTab: 'roles', initialRoleId: TEACHER.id });
    const matrix = await screen.findByRole('table', { name: 'What Teacher can do' });
    expect(within(matrix).getByRole('checkbox', { name: 'Edit in LMS & gradebook' })).toBeChecked();
    expect(
      within(matrix).getByRole('checkbox', { name: 'Edit in LMS & gradebook' }),
    ).toBeDisabled();
    expect(
      within(within(matrix).getByRole('row', { name: /Transport/ })).getByText('Not in plan'),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'See medical notes' })).toBeDisabled();
  });

  it('edits a custom role with the matrix rules, and saves it from the save bar', async () => {
    resetFake({
      ...fake.answers,
      [`PUT /api/v1/roles/${BURSAR.id}/permissions`]: { status: 200, body: BURSAR },
    });
    renderPage({ initialTab: 'roles', initialRoleId: BURSAR.id });
    const matrix = await screen.findByRole('table', { name: 'What Bursar can do' });
    expect(screen.queryByText('Unsaved changes to Bursar')).toBeNull();
    await userEvent.click(
      within(matrix).getByRole('checkbox', { name: 'Approve in Student records' }),
    );
    // Ticking Approve ticks View too (spec 05).
    expect(within(matrix).getByRole('checkbox', { name: 'View in Student records' })).toBeChecked();
    expect(screen.getByText('Unsaved changes to Bursar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Permissions for Bursar saved')).toBeInTheDocument();
    const put = fake.requests.find((request) => request.key.startsWith('PUT'));
    expect(put?.body).toMatchObject({
      matrix: { sis: { ...VIEW, approve: true }, fees: VIEW },
      sensitive: [],
    });
    expect(Object.keys((put?.body as { matrix: object }).matrix)).not.toContain('transport');
  });

  it('keeps unsaved changes until they are saved or discarded', async () => {
    renderPage({ initialTab: 'roles', initialRoleId: BURSAR.id });
    const matrix = await screen.findByRole('table', { name: 'What Bursar can do' });
    await userEvent.click(within(matrix).getByRole('checkbox', { name: 'View in Admissions' }));
    await userEvent.click(screen.getByRole('button', { name: /^Teacher/ }));
    expect(screen.getByText('Save or discard your changes first')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByText('Unsaved changes to Bursar')).toBeNull();
    expect(within(matrix).getByRole('checkbox', { name: 'View in Admissions' })).not.toBeChecked();
  });

  it('keeps unsaved changes when People is chosen, and says to save or discard first', async () => {
    renderPage({ initialTab: 'roles', initialRoleId: BURSAR.id });
    const matrix = await screen.findByRole('table', { name: 'What Bursar can do' });
    await userEvent.click(within(matrix).getByRole('checkbox', { name: 'View in Admissions' }));
    await userEvent.click(screen.getByRole('tab', { name: 'People' }));
    expect(screen.getByText('Save or discard your changes first')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Roles & permissions' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      within(screen.getByRole('table', { name: 'What Bursar can do' })).getByRole('checkbox', {
        name: 'View in Admissions',
      }),
    ).toBeChecked();
  });

  it('keeps unsaved changes when the roles are read again', async () => {
    renderPage({ initialTab: 'roles', initialRoleId: BURSAR.id });
    const matrix = await screen.findByRole('table', { name: 'What Bursar can do' });
    await userEvent.click(within(matrix).getByRole('checkbox', { name: 'View in Admissions' }));
    const reads = () => fake.requests.filter((request) => request.key === 'GET /api/v1/roles');
    const before = reads().length;
    // Someone was given the role meanwhile: a new role object, with the same grant.
    fake.answers['GET /api/v1/roles'] = {
      status: 200,
      body: { ...ROLES, items: [ADMIN, TEACHER, { ...BURSAR, memberCount: 1 }] },
    };
    await userEvent.click(screen.getByRole('button', { name: 'Read roles again' }));
    await waitFor(() => {
      expect(reads().length).toBe(before + 1);
    });
    expect(screen.getByText('Unsaved changes to Bursar')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'What Bursar can do' })).getByRole('checkbox', {
        name: 'View in Admissions',
      }),
    ).toBeChecked();
  });

  it('asks before New role or a reload leaves unsaved changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage({ initialTab: 'roles', initialRoleId: BURSAR.id });
    const matrix = await screen.findByRole('table', { name: 'What Bursar can do' });
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await userEvent.click(within(matrix).getByRole('checkbox', { name: 'View in Admissions' }));
    expect(unload()).toBe(true);
    await userEvent.click(screen.getByRole('link', { name: 'New role' }));
    expect(confirm).toHaveBeenCalledWith(
      'You have unsaved changes. Leave this page and lose them?',
    );
    expect(screen.getByText('Unsaved changes to Bursar')).toBeInTheDocument();
  });

  it('locks a sensitive key the admin does not hold', async () => {
    renderPage({ initialTab: 'roles', initialRoleId: BURSAR.id, held: ['medical'] });
    await screen.findByRole('table', { name: 'What Bursar can do' });
    expect(screen.getByRole('switch', { name: 'See medical notes' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'See safeguarding notes' })).toBeDisabled();
    expect(screen.getAllByText('You don’t have this yourself, so you can’t give it.')).toHaveLength(
      3,
    );
  });
});

describe('Users & roles: Preview a role', () => {
  it('lists each role with its pages and where it starts, and previews it', async () => {
    resetFake({
      ...fake.answers,
      'POST /api/v1/me/role-preview': {
        status: 200,
        body: { keys: [], pages: [], home: 'my_teaching', preview: null },
      },
    });
    renderPage();
    const card = await screen.findByRole('region', { name: 'Preview a role' });
    expect(within(card).getByText('9 pages · opens on My teaching')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Preview as Bursar' }));
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/app/teaching');
    });
    expect(fake.requests).toContainEqual({
      key: 'POST /api/v1/me/role-preview',
      body: { roleId: BURSAR.id },
      csrf: 'csrf-1',
    });
  });

  it('is not offered while a preview is on', async () => {
    renderPage({ canPreview: false });
    await screen.findByRole('table', { name: 'Staff accounts' });
    expect(screen.queryByRole('region', { name: 'Preview a role' })).toBeNull();
  });
});
