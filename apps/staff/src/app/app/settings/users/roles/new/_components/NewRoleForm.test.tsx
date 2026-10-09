import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '../../../../../../../../test/fake-api';

import { NewRoleForm } from './NewRoleForm';

import type * as Api from '@/lib/api';
import type { Role, RoleList } from '@quad/contracts';

import { Providers } from '@/components/Providers';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('../../../../../../../../test/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});
const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/users/roles/new',
  useRouter: () => ({ push }),
}));

const NONE = { view: false, create: false, edit: false, delete: false, approve: false };
const VIEW = { ...NONE, view: true };
const MATRIX: Role['matrix'] = {
  admissions: NONE,
  crm: NONE,
  sis: VIEW,
  attendance: NONE,
  lms: NONE,
  fees: NONE,
  finance: NONE,
  transport: NONE,
  settings: NONE,
};
const TEACHER: Role = {
  id: '0190a000-0000-7000-8000-0000000000a2',
  key: 'teacher',
  name: 'Teacher',
  description: null,
  color: null,
  system: true,
  scope: 'own_classes',
  baseRoleKey: null,
  memberCount: 2,
  pageCount: 9,
  home: 'my_teaching',
  matrix: MATRIX,
  sensitive: [],
};
const ROLES: RoleList = { items: [TEACHER], nextCursor: null, outsidePlan: ['transport'] };
const CREATED: Role = {
  ...TEACHER,
  id: '0190a000-0000-7000-8000-0000000000c1',
  key: 'custom_1',
  name: 'Year lead',
  system: false,
  memberCount: 0,
};

function renderForm() {
  return render(
    <Providers>
      <NewRoleForm held={['medical']} />
    </Providers>,
  );
}

async function fillIn() {
  await userEvent.type(await screen.findByLabelText('Role name'), 'Year lead');
  const matrix = screen.getByRole('table', { name: 'What New role can do' });
  await userEvent.click(within(matrix).getByRole('checkbox', { name: 'View in Fees & invoicing' }));
}

const unloadIsHeld = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  resetFake({ 'GET /api/v1/roles': { status: 200, body: ROLES } });
  push.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('New role', () => {
  it('creates the role with the grant chosen here, in one request', async () => {
    fake.answers['POST /api/v1/roles'] = { status: 201, body: CREATED };
    renderForm();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByText('Year lead created')).toBeInTheDocument();
    const writes = fake.requests.filter((request) => !request.key.startsWith('GET'));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toMatchObject({
      name: 'Year lead',
      baseRoleKey: 'teacher',
      permissions: { matrix: { sis: VIEW, fees: VIEW }, sensitive: [] },
    });
    expect(
      Object.keys((writes[0]?.body as { permissions: { matrix: object } }).permissions.matrix),
    ).not.toContain('transport');
    expect(push).toHaveBeenCalledWith(`/app/settings/users?tab=roles&role=${CREATED.id}`);
  });

  it('stays on the form with the draft when creating is refused, and says why', async () => {
    fake.answers['POST /api/v1/roles'] = {
      status: 403,
      body: {
        code: 'forbidden',
        message: 'You can’t give access to sensitive data you don’t have yourself.',
      },
    };
    renderForm();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(
      await screen.findByText('You can’t give access to sensitive data you don’t have yourself.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Year lead created')).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole('table', { name: 'What New role can do' })).getByRole('checkbox', {
        name: 'View in Fees & invoicing',
      }),
    ).toBeChecked();
  });

  it('asks before Cancel, Back or a reload leaves what was entered', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderForm();
    await screen.findByLabelText('Role name');
    expect(unloadIsHeld()).toBe(false);
    await fillIn();
    expect(unloadIsHeld()).toBe(true);
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('link', { name: 'Roles & permissions' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledWith(
      'You have unsaved changes. Leave this page and lose them?',
    );
  });

  it('does not ask once the role is created', async () => {
    fake.answers['POST /api/v1/roles'] = { status: 201, body: CREATED };
    renderForm();
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await waitFor(() => {
      expect(push).toHaveBeenCalled();
    });
    expect(unloadIsHeld()).toBe(false);
  });
});
