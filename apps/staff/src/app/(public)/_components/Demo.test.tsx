import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Demo } from './Demo';

/*
 * The real demo panel with the real copy (en.json), as the live site builds it: the form's own
 * tests use fixed labels, so this pins what visitors read.
 */

const fetchMock = vi.fn<typeof fetch>();

beforeAll(async () => {
  await import('../_lib/demo-checks');
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Demo on the live site', () => {
  it('on 429 says to try again later, never naming an hour: the daily email limit answers 429 too', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'rate_limited', message: 'x' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { container } = render(<Demo prelaunch={false} />);
    // Both forms are in the page; the view shows one. The school's is first.
    const school = within(container.querySelectorAll('form')[0] ?? container);
    await userEvent.type(school.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(school.getByLabelText('Work email'), 'name@school.org');
    await userEvent.type(school.getByLabelText('School'), 'Sample School');
    await userEvent.click(school.getByRole('button', { name: /Request a demo/ }));

    await waitFor(() =>
      expect(school.getByRole('alert')).toHaveTextContent(
        'You’ve sent a few requests already. Try again later, or email support@quad-edu.com.',
      ),
    );
    expect(school.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:support@quad-edu\.com\?subject=Demo%20request/),
    );
    expect(screen.queryByText(/an hour/)).toBeNull();
  });
});
