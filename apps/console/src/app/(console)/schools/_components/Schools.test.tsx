import { fake, resetFake } from '@quad/config/vitest/fake-api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Schools } from './Schools';

import type * as Api from '@/lib/api';

import { Providers } from '@/components/Providers';
import { ConsoleSession } from '@/components/session/ConsoleSession';
import { openPage } from '@/lib/navigate';

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

const COLOMBO = {
  id: '01926f00-0000-7000-8000-000000000101',
  name: 'Colombo International School',
  shortName: 'CIS',
  status: 'active',
  brandColor: '#1F6FEB',
};
const KANDY = {
  id: '01926f00-0000-7000-8000-000000000102',
  name: 'Kandy Hill Academy',
  shortName: 'KHA',
  status: 'suspended',
  brandColor: null,
};
const LINK = 'http://localhost:3000/sign-in/support/a.b';

function renderAs(role: string, extra: Record<string, unknown> = {}) {
  resetFake({
    'GET /api/v1/platform/me': {
      status: 200,
      body: { id: '01926f00-0000-7000-8000-000000000302', name: 'Amal Gunawardena', role },
    },
    'GET /api/v1/platform/tenants': {
      status: 200,
      body: { items: [COLOMBO, KANDY], nextCursor: null },
    },
    ...extra,
  });
  return render(
    <Providers>
      <ConsoleSession>
        <Schools />
      </ConsoleSession>
    </Providers>,
  );
}

/** The table once the schools have loaded. */
async function tableWithRows() {
  const table = await screen.findByRole('table', { name: 'Schools on Quad' });
  await within(table).findByText('Colombo International School');
  return table;
}

const reasonBox = () => screen.getByRole('textbox', { name: 'Why are you opening this school?' });

beforeEach(() => {
  vi.mocked(openPage).mockClear();
});

describe('Schools', () => {
  it('tells the story, then lists each school with its status', async () => {
    renderAs('support');
    expect(await screen.findByText(/2 schools are on Quad\./)).toBeInTheDocument();
    const table = await tableWithRows();
    expect(within(table).getByText('Colombo International School')).toBeInTheDocument();
    expect(within(table).getByText('Active')).toBeInTheDocument();
    expect(within(table).getByText('Suspended')).toBeInTheDocument();
  });

  it('offers Open as school admin to support, but not for a suspended school', async () => {
    renderAs('support');
    const table = await tableWithRows();
    expect(
      within(table).getByRole('button', {
        name: 'Open Colombo International School as school admin',
      }),
    ).toBeEnabled();
    expect(
      within(table).getByRole('button', { name: 'Open Kandy Hill Academy as school admin' }),
    ).toBeDisabled();
  });

  it.each(['billing', 'readonly'])(
    'offers no Open as school admin to %s (spec 05)',
    async (role) => {
      renderAs(role);
      const table = await tableWithRows();
      expect(within(table).queryByRole('button', { name: /as school admin/ })).toBeNull();
    },
  );

  it('always asks for a reason, checked before anything is sent (D22)', async () => {
    renderAs('owner');
    const table = await tableWithRows();
    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Open Colombo International School as school admin',
      }),
    );
    const drawer = await screen.findByRole('dialog', {
      name: 'Open Colombo International School as school admin',
    });
    expect(within(drawer).getByText(/in 10 to 500 characters/)).toBeInTheDocument();
    const submit = within(drawer).getByRole('button', {
      name: 'Open Colombo International School as school admin',
    });
    await userEvent.click(submit);
    expect(within(drawer).getByText(/at least 10 characters/)).toBeInTheDocument();
    await userEvent.type(reasonBox(), 'Too short');
    await userEvent.click(submit);
    expect(within(drawer).getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(fake.requests.filter((request) => request.key.startsWith('POST'))).toEqual([]);
    expect(openPage).not.toHaveBeenCalled();
  });

  it('opens the school with the reason and the CSRF header, then follows the link', async () => {
    renderAs('support', {
      [`POST /api/v1/platform/tenants/${COLOMBO.id}/support-session`]: {
        status: 200,
        body: { url: LINK },
      },
    });
    const table = await tableWithRows();
    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Open Colombo International School as school admin',
      }),
    );
    await userEvent.type(reasonBox(), '  Principal asked for help with fee reminders  ');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Open Colombo International School as school admin',
      }),
    );
    await vi.waitFor(() => {
      expect(openPage).toHaveBeenCalledWith(LINK);
    });
    const sent = fake.requests.find((request) => request.key.endsWith('/support-session'));
    expect(sent).toMatchObject({
      body: { reason: 'Principal asked for help with fee reminders' },
      csrf: 'csrf-1',
    });
  });

  it('shows the API’s field message under the reason', async () => {
    renderAs('support', {
      [`POST /api/v1/platform/tenants/${COLOMBO.id}/support-session`]: {
        status: 400,
        body: {
          code: 'validation',
          message: 'Check the form',
          fields: { reason: 'Write the reason as plain text; line breaks are fine.' },
        },
      },
    });
    const table = await tableWithRows();
    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Open Colombo International School as school admin',
      }),
    );
    await userEvent.type(reasonBox(), 'A reason the API refuses');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Open Colombo International School as school admin',
      }),
    );
    expect(
      await screen.findByText('Write the reason as plain text; line breaks are fine.'),
    ).toBeInTheDocument();
    expect(openPage).not.toHaveBeenCalled();
  });
});
