import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Users } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell, type AppShellProps } from './AppShell';
import { RAIL_STORAGE_KEY } from './theme';
import { isActiveHref, type ShellLabels } from './types';

const labels: ShellLabels = {
  skipToContent: 'Skip to main content',
  sidebar: 'Side bar',
  nav: 'Main',
  collapse: 'Collapse side bar',
  expand: 'Expand side bar',
  openMenu: 'Open menu',
  menuTitle: 'Menu',
  close: 'Close',
  search: 'Search students, staff and pages',
  searchShortcut: 'Ctrl K',
  paletteLabel: 'Search',
  paletteEmpty: 'No results',
  palettePages: 'Pages',
  askQuad: 'Ask Quad',
  askQuadShortcut: '/',
  themeToggle: 'Change theme',
  themeCurrent: (choice) => `Theme: ${choice}`,
  notifications: 'Show notifications',
  profile: 'Open your profile menu',
  profileMenu: 'Your profile',
  signOut: 'Sign out',
};

function renderShell(onNavigate = vi.fn(), extra: Partial<AppShellProps> = {}) {
  render(
    <AppShell
      variant="staff"
      brand={{ title: 'Quad', subtitle: 'Colombo International School' }}
      user={{ name: 'Prishan Maduka', role: 'Administrator' }}
      groups={[
        {
          id: 'overview',
          label: 'Overview',
          items: [{ href: '/app', label: 'Home', icon: Home, exact: true }],
        },
        {
          id: 'people',
          label: 'Student information',
          items: [{ href: '/app/students', label: 'Students', icon: Users, count: 3 }],
        },
      ]}
      currentHref="/app"
      labels={labels}
      onNavigate={onNavigate}
      {...extra}
    >
      <h1>Page</h1>
    </AppShell>,
  );
  return onNavigate;
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('labels the side bar and its grouped navigation, and marks the current page', () => {
    renderShell();
    const rail = screen.getByRole('complementary', { name: 'Side bar' });
    const nav = within(rail).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Students/ })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('list', { name: 'Student information' })).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'Page' }),
    );
  });

  it('collapses the side bar, keeps link names for screen readers and remembers it', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse side bar' }));
    expect(localStorage.getItem(RAIL_STORAGE_KEY)).toBe('collapsed');
    expect(document.documentElement.getAttribute('data-rail')).toBe('collapsed');
    const rail = screen.getByRole('complementary', { name: 'Side bar' });
    expect(within(rail).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand side bar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand side bar' }));
    expect(localStorage.getItem(RAIL_STORAGE_KEY)).toBe('expanded');
    expect(document.documentElement.hasAttribute('data-rail')).toBe(false);
  });

  it('opens the phone menu as a dialog that closes when a link is followed', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    await userEvent.click(within(menu).getByRole('link', { name: 'Home' }));
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('opens the search palette with the pages and goes to the one chosen', async () => {
    const onNavigate = renderShell();
    await userEvent.click(screen.getByRole('button', { name: /Search students, staff and pages/ }));
    const palette = screen.getByRole('dialog', { name: 'Search' });
    await userEvent.click(within(palette).getByRole('option', { name: /Students/ }));
    expect(onNavigate).toHaveBeenCalledWith('/app/students');
  });

  it('cycles the theme and describes the current one', async () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Change theme' });
    expect(toggle).toHaveAccessibleDescription('Theme: system');
    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(toggle).toHaveAccessibleDescription('Theme: light');
    await userEvent.click(toggle);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('quad-theme')).toBe('dark');
    await userEvent.click(toggle);
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('AppShell slots', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a banner between the top bar and the page', () => {
    renderShell(vi.fn(), { banner: <div role="status">Support view</div> });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Support view');
    expect(screen.getByRole('banner').compareDocumentPosition(banner)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(banner.compareDocumentPosition(screen.getByRole('main'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('puts the desktop actions in the top bar, hidden on narrow screens', () => {
    renderShell(vi.fn(), { actions: <button type="button">View as</button> });
    const action = within(screen.getByRole('banner')).getByRole('button', { name: 'View as' });
    expect(action.parentElement).toHaveClass('max-[899px]:hidden');
  });

  it('signs out from the side bar', async () => {
    const onSignOut = vi.fn();
    renderShell(vi.fn(), { onSignOut });
    const rail = screen.getByRole('complementary', { name: 'Side bar' });
    await userEvent.click(within(rail).getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('opens the profile menu with its heading and sections, and closes after a choice', async () => {
    const switchTo = vi.fn();
    const signOut = vi.fn();
    renderShell(vi.fn(), {
      profileMenu: {
        heading: 'Colombo International School',
        sections: [
          {
            id: 'schools',
            label: 'Switch school',
            items: [
              { id: 'kha', label: 'Kandy Hill Academy', onSelect: switchTo },
              {
                id: 'paused',
                label: 'Galle Bay School',
                hint: 'Paused',
                disabled: true,
                onSelect: vi.fn(),
              },
            ],
          },
          { id: 'account', items: [{ id: 'sign-out', label: 'Sign out', onSelect: signOut }] },
        ],
      },
    });
    const trigger = screen.getByRole('button', { name: 'Open your profile menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    const menu = screen.getByRole('dialog', { name: 'Your profile' });
    expect(within(menu).getByText('Colombo International School')).toBeInTheDocument();
    expect(within(menu).getByRole('list', { name: 'Switch school' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: /Galle Bay School/ })).toBeDisabled();
    await userEvent.click(within(menu).getByRole('button', { name: 'Kandy Hill Academy' }));
    expect(switchTo).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Your profile' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('shows the school’s initials on the brand tile instead of the Quad mark', () => {
    render(
      <AppShell
        variant="staff"
        brand={{ title: 'Colombo International School', subtitle: 'Staff portal', initials: 'CIS' }}
        user={{ name: 'Prishan Maduka', role: 'School admin' }}
        groups={[]}
        currentHref="/app"
        labels={labels}
        onNavigate={vi.fn()}
      >
        <h1>Page</h1>
      </AppShell>,
    );
    const rail = screen.getByRole('complementary', { name: 'Side bar' });
    expect(within(rail).getByText('CIS')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('isActiveHref', () => {
  it('matches the page and the pages below it, except for exact items', () => {
    expect(isActiveHref({ href: '/app/students' }, '/app/students/42')).toBe(true);
    expect(isActiveHref({ href: '/app', exact: true }, '/app/students')).toBe(false);
    expect(isActiveHref({ href: '/app', exact: true }, '/app')).toBe(true);
    expect(isActiveHref({ href: '/app/fee' }, '/app/fees')).toBe(false);
  });
});
