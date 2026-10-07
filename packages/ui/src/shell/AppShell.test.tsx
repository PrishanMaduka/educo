import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Users } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell, RAIL_STORAGE_KEY } from './AppShell';
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
  signOut: 'Sign out',
};

function renderShell(onNavigate = vi.fn()) {
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
    const rail = screen.getByRole('complementary', { name: 'Side bar' });
    expect(within(rail).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand side bar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand side bar' }));
    expect(localStorage.getItem(RAIL_STORAGE_KEY)).toBe('expanded');
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

describe('isActiveHref', () => {
  it('matches the page and the pages below it, except for exact items', () => {
    expect(isActiveHref({ href: '/app/students' }, '/app/students/42')).toBe(true);
    expect(isActiveHref({ href: '/app', exact: true }, '/app/students')).toBe(false);
    expect(isActiveHref({ href: '/app', exact: true }, '/app')).toBe(true);
    expect(isActiveHref({ href: '/app/fee' }, '/app/fees')).toBe(false);
  });
});
