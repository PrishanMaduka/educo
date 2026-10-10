import { Me } from '@quad/contracts';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import PublicLayout from '../layout';
import LandingPage from '../page';

import { SignedInSchool } from './signed-in-school';

import type { z } from 'zod';

const GREENFIELD = 'Greenfield International School';
const OPEN = `Open ${GREENFIELD}`;

const brandTheme = {
  fill: '#2BB0A0',
  fillStrong: '#49BBAD',
  ink: '#101632',
  text: '#1D786D',
  soft: '#DDF2F0',
  railActive: '#2BB0A0',
  railActiveInk: '#101632',
};

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
    name: GREENFIELD,
    shortName: 'GIS',
    timeZone: 'Asia/Colombo',
    brand: { color: '#2BB0A0', light: brandTheme, dark: brandTheme },
  },
  memberships: [],
  preview: null,
  support: null,
  greeting: { period: 'morning', word: 'Good morning' },
};

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setCookie(cookie: string): void {
  document.cookie = cookie;
}

function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

/** The landing page inside the public layout, as the live site serves it. */
function renderLanding() {
  return render(
    <PublicLayout>
      <LandingPage />
    </PublicLayout>,
  );
}

const signInButtons = () =>
  document.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"][data-signin]');

// jsdom has no matchMedia; the landing's theme button and stage ask it. Reduced motion keeps the
// stage still, so no timers run during the test.
function stubMatchMedia(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

// The public layout's inline view script makes React warn that client-rendered scripts never
// run; on the real page it is server-rendered, so the warning is noise here and is dropped.
const SCRIPT_TAG_WARNING = 'Encountered a script tag while rendering React component';
const consoleError = console.error.bind(console);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith(SCRIPT_TAG_WARNING)) return;
    consoleError(...args);
  });
  stubMatchMedia();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  // Unmount before the stubs go: hooks run last-registered first, before the setup's cleanup.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearCookies();
  document.documentElement.removeAttribute('data-view');
});

describe('SignedInHint (Open {school}, spec 19 "Sign-in", D57)', () => {
  it('reads a true slice of the Me contract, and the fixture is a valid GET /me answer', () => {
    expectTypeOf<Me>().toExtend<z.infer<typeof SignedInSchool>>();
    expect(Me.safeParse(ME).success).toBe(true);
    expect(SignedInSchool.safeParse(ME).success).toBe(true);
  });

  it('asks nothing without the CSRF cookie, so an anonymous visitor costs no request', async () => {
    renderLanding();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signInButtons().length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /^Open / })).toBeNull();
  });

  it('never takes the school from quad_last_school: that cookie alone asks nothing', async () => {
    setCookie(`quad_last_school=${encodeURIComponent(GREENFIELD)}`);
    renderLanding();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /^Open / })).toBeNull();
  });

  it('turns every Sign in into a link "Open {school}" to /app when /me answers 200', async () => {
    setCookie('quad_csrf=token');
    // The school's name comes from the answer only, never from this cookie.
    setCookie('quad_last_school=Somewhere%20Else');
    fetchMock.mockResolvedValue(answer(200, ME));
    renderLanding();
    const entries = signInButtons().length;
    expect(entries).toBe(4); // top bar, menu, hero and footer

    const links = await screen.findAllByRole('link', { name: OPEN, hidden: true });
    expect(links).toHaveLength(entries);
    for (const link of links) expect(link).toHaveAttribute('href', '/app');
    expect(signInButtons()).toHaveLength(0);
    expect(screen.queryByText(/Somewhere Else/)).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/me');
    expect(init).toMatchObject({ credentials: 'same-origin' });
  });

  it('reads the production cookie name, __Host-quad_csrf, too', async () => {
    // jsdom refuses to set a __Host- cookie on http://, so the page's cookie string is stubbed.
    vi.spyOn(document, 'cookie', 'get').mockReturnValue('__Host-quad_csrf=token');
    fetchMock.mockResolvedValue(answer(200, ME));
    renderLanding();
    expect(await screen.findAllByRole('link', { name: OPEN, hidden: true })).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows Open {school} in a support session or a role preview too', async () => {
    setCookie('quad_csrf=token');
    fetchMock.mockResolvedValue(
      answer(200, {
        ...ME,
        support: { schoolName: GREENFIELD, platformUserName: 'Quad Support' },
        preview: {
          roleId: '0190a000-0000-7000-8000-0000000000c1',
          roleName: 'Teacher',
          sampleUser: null,
        },
      }),
    );
    renderLanding();
    expect(await screen.findAllByRole('link', { name: OPEN, hidden: true })).toHaveLength(4);
  });

  it.each([
    // Each refusal carries a Me-shaped body, so only the status can keep Sign in.
    ['401', () => answer(401, ME)],
    ['403', () => answer(403, ME)],
    ['500', () => answer(500, ME)],
    ['an answer that is not a Me', () => answer(200, { school: { name: 42 } })],
    ['an answer that is not JSON', () => new Response('<html>', { status: 200 })],
  ])('keeps Sign in on %s', async (_case, reply) => {
    setCookie('quad_csrf=token');
    fetchMock.mockResolvedValue(reply());
    renderLanding();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signInButtons()).toHaveLength(4);
    expect(screen.queryByRole('link', { name: /^Open /, hidden: true })).toBeNull();
  });

  it('keeps Sign in when offline (the request fails)', async () => {
    setCookie('quad_csrf=token');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderLanding();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signInButtons()).toHaveLength(4);
  });

  it('in the parent view shows Open {school} only in the footer, whose cards are the same in both views', async () => {
    document.documentElement.setAttribute('data-view', 'parent');
    setCookie('quad_csrf=token');
    fetchMock.mockResolvedValue(answer(200, ME));
    renderLanding();
    const links = await screen.findAllByRole('link', { name: OPEN, hidden: true });
    // The parent view hides school-only content with `view-parent:hidden` (spec 19: no sign-in
    // there); the footer's For schools card is the same in both views.
    const shown = links.filter((link) => !link.closest('.view-parent\\:hidden'));
    expect(shown).toHaveLength(1);
    expect(shown[0]?.closest('footer')).not.toBeNull();
  });
});
