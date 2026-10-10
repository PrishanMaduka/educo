import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fake, resetFake } from '@quad/config/vitest/fake-api';

import { StaffShell } from './StaffShell';

import type * as Api from '@/lib/api';
import type { Me, MePermissions, StaffPageAccess } from '@quad/contracts';

import { Providers } from '@/components/Providers';
import { openPage } from '@/lib/navigate';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  const { fakeCookies, fakeFetch } = await import('@quad/config/vitest/fake-api');
  const client = actual.createStaffApi('http://localhost:3000', {
    fetch: fakeFetch,
    cookies: fakeCookies,
  });
  return { ...actual, staffApi: () => client };
});
vi.mock('@/lib/navigate', () => ({ openPage: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ push: vi.fn() }),
}));

const KANDY = '0190a000-0000-7000-8000-0000000000b2';
const ROLE = '0190a000-0000-7000-8000-0000000000c1';

const ME: Me = {
  person: {
    name: 'Prishan Maduka',
    firstName: 'Prishan',
    theme: 'system',
    locale: 'en-LK',
    roleNames: ['School admin'],
  },
  school: {
    id: '0190a000-0000-7000-8000-0000000000b1',
    name: 'Colombo International School',
    shortName: 'CIS',
    timeZone: 'Asia/Colombo',
    brand: { color: '#2BB0A0', fill: '#1F7F73', fillDark: '#4CC9B8', ink: '#FFFFFF' },
  },
  memberships: [
    {
      tenantId: KANDY,
      name: 'Kandy Hill Academy',
      shortName: 'KHA',
      brandColor: null,
      roleNames: ['Teacher'],
      suspended: false,
    },
    {
      tenantId: '0190a000-0000-7000-8000-0000000000b3',
      name: 'Galle Bay School',
      shortName: 'GBS',
      brandColor: null,
      roleNames: ['Teacher'],
      suspended: true,
    },
  ],
  preview: null,
  support: null,
  greeting: { period: 'morning', word: 'Good morning' },
};

const pages = (open: Partial<Record<StaffPageAccess['id'], StaffPageAccess['access']>>) =>
  Object.entries(open).map(([id, access]) => ({ id, access }) as StaffPageAccess);

const ADMIN: MePermissions = {
  keys: ['settings.view', 'users.manage'],
  pages: pages({ dashboard: 'full', communications: 'full', users_roles: 'full' }),
  home: 'dashboard',
  preview: null,
};

function renderShell(me: Me = ME, permissions: MePermissions = ADMIN) {
  return render(
    <Providers>
      <StaffShell me={me} permissions={permissions}>
        <h1>Page</h1>
      </StaffShell>
    </Providers>,
  );
}

async function openProfileMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Open your profile menu' }));
  return screen.getByRole('dialog', { name: 'Your profile' });
}

beforeEach(() => {
  resetFake({ 'GET /api/v1/roles': { status: 200, body: { items: [], nextCursor: null } } });
  vi.mocked(openPage).mockClear();
  document.documentElement.removeAttribute('data-school-brand');
});

describe('StaffShell', () => {
  it('shows the fixed failed-preview notice after the reload, then drops it from the address', async () => {
    window.history.replaceState(null, '', '/app?notice=preview_failed');
    renderShell();
    expect(
      await screen.findByText('We couldn’t open that preview, so you’re back in your own view.'),
    ).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('shows nothing for a notice it does not know', () => {
    window.history.replaceState(null, '', '/app?notice=%3Cb%3Ehi%3C%2Fb%3E');
    renderShell();
    expect(screen.queryByText('<b>hi</b>')).toBeNull();
    expect(screen.queryByText(/couldn’t open that preview/)).toBeNull();
    window.history.replaceState(null, '', '/app');
  });

  it('lists only the pages the role opens, in their groups, under the school’s name', () => {
    renderShell();
    const rail = screen.getByRole('complementary', { name: 'Side bar' });
    const nav = within(rail).getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Dashboard', 'Communications', 'Users & roles']);
    expect(within(nav).getByRole('list', { name: 'Relationships' })).toBeInTheDocument();
    expect(within(nav).queryByRole('list', { name: 'Finance' })).toBeNull();
    expect(within(rail).getByText('Colombo International School')).toBeInTheDocument();
    expect(within(rail).getByText('School admin')).toBeInTheDocument();
  });

  it('sets the school’s computed brand as CSS variables, never as classes', () => {
    const { container } = renderShell();
    const scope = container.querySelector('[data-school-brand]');
    expect(scope).not.toBeNull();
    expect(scope?.getAttribute('style')).toContain('--school-brand: #2BB0A0');
    expect(scope?.getAttribute('style')).toContain('--school-brand-fill: #1F7F73');
    expect(scope?.getAttribute('style')).toContain('--school-brand-fill-dark: #4CC9B8');
    expect(scope?.getAttribute('style')).toContain('--school-brand-ink: #FFFFFF');
    expect(container.innerHTML).not.toMatch(/class="[^"]*#[0-9a-f]{6}/i);
    expect(document.documentElement).toHaveAttribute('data-school-brand');
  });

  it('switches school from the profile menu and reloads the portal', async () => {
    resetFake({ 'POST /api/v1/auth/select-school': { status: 204 } });
    renderShell();
    const menu = await openProfileMenu();
    expect(within(menu).getByText('Colombo International School')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /Galle Bay School/ })).toBeDisabled();
    await userEvent.click(within(menu).getByRole('button', { name: 'Kandy Hill Academy' }));
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/app');
    });
    expect(fake.requests).toContainEqual({
      key: 'POST /api/v1/auth/select-school',
      body: { tenantId: KANDY, remember: false },
      csrf: 'csrf-1',
    });
  });

  it('says so when a school cannot be opened, and stays', async () => {
    resetFake({
      'POST /api/v1/auth/select-school': { status: 403, body: { code: 'forbidden', message: 'x' } },
    });
    renderShell();
    await userEvent.click(
      within(await openProfileMenu()).getByRole('button', { name: 'Kandy Hill Academy' }),
    );
    expect(
      await screen.findByText('You can’t open that school with this account.'),
    ).toBeInTheDocument();
    expect(openPage).not.toHaveBeenCalled();
  });

  it('signs out from the profile menu and goes to sign-in', async () => {
    resetFake({ 'POST /api/v1/auth/sign-out': { status: 204 } });
    renderShell();
    await userEvent.click(
      within(await openProfileMenu()).getByRole('button', { name: 'Sign out' }),
    );
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/sign-in');
    });
  });

  it('shows View as only to people who can preview roles', () => {
    renderShell(ME, { ...ADMIN, keys: ['settings.view'] });
    expect(screen.queryByRole('combobox', { name: 'View as role' })).toBeNull();
  });

  it('offers View as with the school’s roles to an admin', async () => {
    resetFake({
      'GET /api/v1/roles': {
        status: 200,
        body: { items: [], nextCursor: null },
      },
    });
    renderShell();
    expect(screen.getByRole('combobox', { name: 'View as role' })).toHaveTextContent(
      'View as: you',
    );
    await waitFor(() => {
      expect(fake.requests.map((request) => request.key)).toContain('GET /api/v1/roles');
    });
  });
});

describe('StaffShell while previewing a role', () => {
  const previewing: Me = {
    ...ME,
    preview: {
      roleId: ROLE,
      roleName: 'Teacher',
      sampleUser: { id: '0190a000-0000-7000-8000-000000000202', name: 'Nadeesha Jayasinghe' },
    },
  };
  const teacher: MePermissions = {
    keys: ['lms.create', 'lms.view'],
    pages: pages({ my_teaching: 'full', attendance: 'view_only' }),
    home: 'my_teaching',
    preview: previewing.preview,
  };

  it('shows the banner with the role and sample person, and Back to my view ends it', async () => {
    resetFake({ 'DELETE /api/v1/me/role-preview': { status: 204 } });
    renderShell(previewing, teacher);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Previewing as Teacher · Nadeesha Jayasinghe');
    await userEvent.click(within(banner).getByRole('button', { name: 'Back to my view' }));
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('/app');
    });
    expect(fake.requests).toContainEqual({
      key: 'DELETE /api/v1/me/role-preview',
      body: undefined,
      csrf: 'csrf-1',
    });
  });

  it('offers Back to my view in the profile menu instead of Switch school', async () => {
    renderShell(previewing, teacher);
    const menu = await openProfileMenu();
    const buttons = within(menu)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(buttons).toEqual(['Back to my view', 'Sign out']);
  });

  it('keeps View as on, showing the previewed role', () => {
    renderShell(previewing, teacher);
    expect(screen.getByRole('combobox', { name: 'View as role' })).toHaveTextContent(
      'View as: Teacher',
    );
  });
});

describe('StaffShell in a support visit', () => {
  const visit: Me = {
    ...ME,
    person: { ...ME.person, name: 'Amal Gunawardena', firstName: 'Amal', roleNames: [] },
    memberships: [],
    support: { schoolName: 'Colombo International School', platformUserName: 'Amal Gunawardena' },
  };

  it('shows the support banner and leaves for the console with Exit to platform', async () => {
    resetFake({
      'POST /api/v1/auth/support-session/end': {
        status: 200,
        body: { redirect: 'http://localhost:3001/' },
      },
    });
    renderShell(visit);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(
      'Support view: you’re in Colombo International School as Amal Gunawardena from Quad. Everything you do here is logged in the school’s audit log.',
    );
    expect(screen.queryByRole('combobox', { name: 'View as role' })).toBeNull();
    await userEvent.click(within(banner).getByRole('button', { name: 'Exit to platform' }));
    await waitFor(() => {
      expect(openPage).toHaveBeenCalledWith('http://localhost:3001/');
    });
    expect(
      within(screen.getByRole('complementary', { name: 'Side bar' })).getByText('Quad support'),
    ).toBeInTheDocument();
  });
});
