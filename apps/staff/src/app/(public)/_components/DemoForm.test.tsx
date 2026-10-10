import { DemoRequestBody } from '@quad/contracts/public';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { track } from '../_lib/track';

import { DemoForm, type DemoFormLabels, type DemoSendLabels } from './DemoForm';

import type { TurnstileApi, TurnstileRenderOptions, TurnstileSetup } from '../_live';

vi.mock('../_lib/track', () => ({ track: vi.fn() }));

const marker = { slot: '⁣slot⁣', label: '⁣label⁣', value: '⁣value⁣' };

function labels(variant: 'school' | 'parent'): DemoFormLabels {
  const isSchool = variant === 'school';
  return {
    name: 'Your name',
    email: isSchool ? 'Work email' : 'Your email',
    school: isSchool ? 'School' : 'Your child’s school',
    place: isSchool ? 'Country' : 'City',
    students: 'Students',
    curriculum: 'Curriculum',
    note: 'A note to the school (optional)',
    noteInEmail: 'Note',
    notePlaceholder: 'Why you’d like Quad at your school',
    studentsOptions: {
      under_300: 'Under 300',
      '300_1000': '300–1,000',
      '1000_2500': '1,000–2,500',
      over_2500: 'More than 2,500',
    },
    curriculumOptions: {
      ib: 'IB',
      cambridge: 'Cambridge',
      edexcel: 'Edexcel',
      american: 'American',
      national: 'National',
      other: 'Other',
    },
    submit: isSchool ? 'Request a demo' : 'Send to my school',
    errors: {
      name_and_school: isSchool
        ? 'Add your name and your school.'
        : 'Add your name and your child’s school.',
      email: isSchool
        ? 'Enter a work email like name@school.org.'
        : 'Enter an email like name@example.com.',
      other: 'Check the fields marked in pink.',
    },
    privacy: 'We’ll only use this to arrange a walkthrough.',
    sent: 'Your email app should open with your request ready to send.',
    fallback: `If it doesn’t open, email us at ${marker.slot}.`,
    emailMarker: marker.slot,
    again: 'Send another',
    mail: {
      subject: isSchool ? `Demo request: ${marker.slot}` : `Quad for ${marker.slot}`,
      intro: 'Hello Quad',
      line: `${marker.label}: ${marker.value}`,
      marker,
    },
  };
}

function sendLabels(variant: 'school' | 'parent'): DemoSendLabels {
  const isSchool = variant === 'school';
  return {
    sending: 'Sending…',
    thanks: isSchool
      ? 'Thank you. We’ll email you within one working day to find a time.'
      : 'Thank you. We’ll get in touch with your child’s school.',
    captchaFailed: 'We couldn’t check that you’re not a robot. Try again.',
    rateLimited: {
      before: 'You’ve sent a few requests already. Try again later, or email ',
      after: '.',
    },
    unavailable: {
      before: 'We couldn’t send your request just now. Try again in a minute, or email ',
      after: '.',
    },
    honeypot: 'Leave this empty',
    protectedNote: {
      before:
        'We’ll only use this to arrange a walkthrough. Protected by Cloudflare Turnstile; see our ',
      link: 'privacy policy',
      after: '.',
    },
  };
}

// The checks are their own chunk (D57); load it once so the first test does not wait for Vite.
beforeAll(async () => {
  await import('../_lib/demo-checks');
});

let opened: string[] = [];
beforeEach(() => {
  opened = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    opened.push(this.href);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const renderForm = (variant: 'school' | 'parent') =>
  render(
    <DemoForm
      variant={variant}
      to="support@quad-edu.com"
      labels={labels(variant)}
      cheer={null}
      mode="mailto"
    />,
  );

describe('DemoForm for schools', () => {
  it('asks for the name and school first, marks them and opens nothing', async () => {
    renderForm('school');
    await userEvent.type(screen.getByLabelText('Work email'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add your name and your school.');
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Add your name and your school.',
    );
    expect(opened).toEqual([]);
  });

  it('then asks for a work email', async () => {
    renderForm('school');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(screen.getByLabelText('School'), 'Sample School');
    await userEvent.type(screen.getByLabelText('Work email'), 'name@school');
    await userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a work email like name@school.org.');
    expect(screen.getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens an email to support with the request, then says what happened', async () => {
    renderForm('school');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(screen.getByLabelText('Work email'), 'name@school.org');
    await userEvent.type(screen.getByLabelText('School'), 'Sample School');
    await userEvent.selectOptions(screen.getByLabelText('Curriculum'), 'cambridge');
    await userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));

    expect(opened).toHaveLength(1);
    const url = new URL(opened[0] ?? '');
    expect(url.pathname).toBe('support@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Demo request: Sample School');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Work email: name@school.org');
    expect(body).toContain('Students: Under 300');
    expect(body).toContain('Curriculum: Cambridge');
    expect(body).not.toContain('Country');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your email app should open with your request ready to send.',
    );
    expect(screen.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      opened[0],
    );

    await userEvent.click(screen.getByRole('button', { name: 'Send another' }));
    expect(screen.getByRole('button', { name: /Request a demo/ })).toBeVisible();
  });
});

describe('DemoForm for parents', () => {
  it('asks for the child’s school in its own words', async () => {
    renderForm('parent');
    await userEvent.click(screen.getByRole('button', { name: /Send to my school/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add your name and your child’s school.');
    expect(screen.queryByLabelText('Curriculum')).toBeNull();
  });

  it('sends the note and city to support, with the school in the subject', async () => {
    renderForm('parent');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Parent');
    await userEvent.type(screen.getByLabelText('Your email'), 'name@example.com');
    await userEvent.type(screen.getByLabelText('Your child’s school'), 'Sample School');
    await userEvent.type(screen.getByLabelText('City'), 'Lisbon');
    await userEvent.type(screen.getByLabelText(/A note to the school/), 'We would love it.');
    await userEvent.click(screen.getByRole('button', { name: /Send to my school/ }));

    const url = new URL(opened[0] ?? '');
    expect(url.pathname).toBe('support@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Quad for Sample School');
    expect(url.searchParams.get('body')).toContain('City: Lisbon');
    expect(url.searchParams.get('body')).toContain('Note: We would love it.');
  });
});

const DUMMY = 'XXXX.DUMMY.TOKEN.XXXX';
const ENDPOINT = '/api/v1/public/demo-requests';

const fetchMock = vi.fn<typeof fetch>();

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const renderLive = (
  variant: 'school' | 'parent',
  turnstile: TurnstileSetup = { dummyToken: DUMMY },
) =>
  render(
    <DemoForm
      variant={variant}
      to="support@quad-edu.com"
      labels={labels(variant)}
      cheer={null}
      mode="endpoint"
      turnstile={turnstile}
      sendLabels={sendLabels(variant)}
    />,
  );

/** What the form posted, as JSON. */
function posted(call = 0): unknown {
  const body = fetchMock.mock.calls[call]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('The form posted no JSON body.');
  return JSON.parse(body);
}

async function fillSchool(): Promise<void> {
  await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
  await userEvent.type(screen.getByLabelText('Work email'), 'name@school.org');
  await userEvent.type(screen.getByLabelText('School'), 'Sample School');
  await userEvent.selectOptions(screen.getByLabelText('Curriculum'), 'cambridge');
}

const requestDemo = () => userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));

const turnstileScripts = () =>
  document.querySelectorAll('script[src^="https://challenges.cloudflare.com/"]');

/**
 * A stand-in for Cloudflare's `window.turnstile`. Like the real explicit render, it puts a hidden
 * `cf-turnstile-response` input in the widget's container, which is inside the form.
 */
function fakeTurnstile() {
  const widgets: TurnstileRenderOptions[] = [];
  const api: TurnstileApi = {
    render: vi.fn((container: HTMLElement, options: TurnstileRenderOptions) => {
      widgets.push(options);
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'cf-turnstile-response';
      input.value = 'token-from-the-hidden-input';
      container.append(input);
      return `widget-${String(widgets.length)}`;
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  return { api, widgets };
}

async function turnstileLoads(api: TurnstileApi): Promise<void> {
  window.turnstile = api;
  await act(async () => {
    window.quadTurnstileReady?.();
    await Promise.resolve();
  });
}

describe('DemoForm sending to Quad (spec 19 "Demo requests", D57)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(track).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const script of turnstileScripts()) script.remove();
    delete window.turnstile;
    delete window.quadTurnstileReady;
  });

  it('sends a school’s request with the token and the honeypot, then says thank you', async () => {
    fetchMock.mockResolvedValue(answer(202));
    renderLive('school');
    await fillSchool();
    await requestDemo();

    const thanks = await screen.findByRole('status');
    expect(thanks).toHaveTextContent(
      'Thank you. We’ll email you within one working day to find a time.',
    );
    expect(screen.getByRole('heading', { name: /Thank you/ })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(ENDPOINT);
    expect(posted()).toEqual({
      kind: 'school',
      name: 'Sample Person',
      email: 'name@school.org',
      school: 'Sample School',
      students: 'under_300',
      curriculum: 'cambridge',
      turnstileToken: DUMMY,
      website: '',
    });
    expect(opened).toEqual([]);
    // No parameters, so no form value can reach analytics.
    expect(vi.mocked(track).mock.calls).toEqual([['demo_requested']]);

    await userEvent.click(screen.getByRole('button', { name: 'Send another' }));
    expect(screen.getByRole('button', { name: /Request a demo/ })).toBeVisible();
  });

  it('sends a parent’s request as kind parent, with the note and city', async () => {
    fetchMock.mockResolvedValue(answer(202));
    renderLive('parent');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Parent');
    await userEvent.type(screen.getByLabelText('Your email'), 'name@example.com');
    await userEvent.type(screen.getByLabelText('Your child’s school'), 'Sample School');
    await userEvent.type(screen.getByLabelText('City'), 'Lisbon');
    await userEvent.type(screen.getByLabelText(/A note to the school/), 'We would love it.');
    await userEvent.click(screen.getByRole('button', { name: /Send to my school/ }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Thank you. We’ll get in touch with your child’s school.',
    );
    expect(posted()).toEqual({
      kind: 'parent',
      name: 'Sample Parent',
      email: 'name@example.com',
      school: 'Sample School',
      city: 'Lisbon',
      note: 'We would love it.',
      turnstileToken: DUMMY,
      website: '',
    });
    expect(vi.mocked(track).mock.calls).toEqual([['parent_request_sent']]);
  });

  it('checks the fields first and sends nothing while they need fixing', async () => {
    renderLive('school');
    await userEvent.type(screen.getByLabelText('Work email'), 'bad');
    await requestDemo();
    expect(await screen.findByText('Add your name and your school.')).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('shows Sending… on a disabled, busy button while it waits', async () => {
    let finish: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderLive('school');
    await fillSchool();
    await requestDemo();
    const button = await screen.findByRole('button', { name: /Sending…/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    finish(answer(202));
    expect(await screen.findByRole('status')).toBeVisible();
  });

  it('marks the fields the API refused, with the form’s own messages', async () => {
    fetchMock.mockResolvedValue(
      answer(400, { code: 'validation', message: 'x', fields: { email: 'Invalid' } }),
    );
    renderLive('school');
    await fillSchool();
    await requestDemo();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a work email like name@school.org.',
      ),
    );
    expect(screen.getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Your name')).not.toHaveAttribute('aria-invalid');
    expect(track).not.toHaveBeenCalled();
  });

  it('asks the visitor to try again when the robot check fails, with a fresh widget', async () => {
    const { api, widgets } = fakeTurnstile();
    fetchMock.mockResolvedValue(answer(400, { code: 'captcha_failed', message: 'x' }));
    renderLive('school', { siteKey: 'site-key' });
    await fillSchool();
    await turnstileLoads(api);
    widgets[0]?.callback('token-1');
    await requestDemo();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'We couldn’t check that you’re not a robot. Try again.',
      ),
    );
    expect(api.reset).toHaveBeenCalledWith('widget-1');
    expect(screen.queryByRole('link', { name: 'support@quad-edu.com' })).toBeNull();
  });

  it.each([
    [
      '429',
      () => Promise.resolve(answer(429, { code: 'rate_limited', message: 'x' })),
      'You’ve sent a few requests already. Try again later, or email support@quad-edu.com.',
    ],
    [
      '503',
      () => Promise.resolve(answer(503, { code: 'captcha_unavailable', message: 'x' })),
      'We couldn’t send your request just now. Try again in a minute, or email support@quad-edu.com.',
    ],
    [
      'a network error',
      () => Promise.reject(new TypeError('Failed to fetch')),
      'We couldn’t send your request just now. Try again in a minute, or email support@quad-edu.com.',
    ],
  ] as const)(
    'on %s, offers the request as an email so it is never lost',
    async (_, reply, copy) => {
      fetchMock.mockImplementation(reply);
      renderLive('school');
      await fillSchool();
      await requestDemo();
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(copy));
      const link = screen.getByRole('link', { name: 'support@quad-edu.com' });
      const mail = new URL(link.getAttribute('href') ?? '');
      expect(mail.protocol).toBe('mailto:');
      expect(mail.pathname).toBe('support@quad-edu.com');
      expect(mail.searchParams.get('subject')).toBe('Demo request: Sample School');
      expect(mail.searchParams.get('body')).toContain('Work email: name@school.org');
      expect(mail.searchParams.get('body')).toContain('Curriculum: Cambridge');
      expect(opened).toEqual([]);
      expect(track).not.toHaveBeenCalled();
      // The form stays, so the visitor can try again.
      expect(screen.getByRole('button', { name: /Request a demo/ })).toBeEnabled();
    },
  );

  it('offers the email when Turnstile cannot give a token, and sends nothing', async () => {
    renderLive('school', { siteKey: 'site-key' });
    await fillSchool();
    for (const script of turnstileScripts()) script.dispatchEvent(new Event('error'));
    await requestDemo();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/We couldn’t send your request/),
    );
    expect(screen.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:support@quad-edu\.com\?subject=Demo%20request/),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has a honeypot no person sees or tabs to, and sends what a bot puts in it', async () => {
    fetchMock.mockResolvedValue(answer(202));
    renderLive('school');
    const honeypot = screen.getByLabelText('Leave this empty');
    expect(honeypot).toHaveAttribute('name', 'website');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Leave this empty' })).toBeNull();

    await fillSchool();
    await userEvent.type(honeypot, 'https://spam.example');
    await requestDemo();
    await screen.findByRole('status');
    expect(posted()).toMatchObject({ website: 'https://spam.example' });
  });

  it('sends a body the strict API accepts, though Turnstile adds an input to the form', async () => {
    const { api, widgets } = fakeTurnstile();
    fetchMock.mockResolvedValue(answer(202));
    const { container } = renderLive('school', { siteKey: 'site-key' });
    await fillSchool();
    await turnstileLoads(api);
    widgets[0]?.callback('token-1');
    expect(container.querySelector('form input[name="cf-turnstile-response"]')).not.toBeNull();

    await requestDemo();
    await screen.findByRole('status');
    const body = posted();
    expect(DemoRequestBody.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ turnstileToken: 'token-1' });
    expect(body).not.toHaveProperty('cf-turnstile-response');
  });

  it('loads Turnstile only on the first focus in the form, invisible and in the page’s theme', async () => {
    const { api, widgets } = fakeTurnstile();
    renderLive('school', { siteKey: 'site-key' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(turnstileScripts()).toHaveLength(0);

    await userEvent.click(screen.getByLabelText('Your name'));
    expect(turnstileScripts()).toHaveLength(1);
    await turnstileLoads(api);
    expect(widgets[0]).toMatchObject({
      sitekey: 'site-key',
      action: 'demo-request',
      appearance: 'interaction-only',
    });
  });

  it('says it is protected by Turnstile and links the privacy policy', () => {
    renderLive('school');
    expect(screen.getByText(/Protected by Cloudflare Turnstile/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute(
      'href',
      '/legal/privacy#website',
    );
  });
});

describe('DemoForm while its checks are still loading', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.doUnmock('../_lib/demo-checks');
    vi.unstubAllGlobals();
  });

  it('sends one request for two quick submits', async () => {
    // A fresh form module whose checks chunk arrives only when the test says so.
    vi.resetModules();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.doMock('../_lib/demo-checks', async (importOriginal) => {
      await gate;
      return importOriginal();
    });
    const { DemoForm: LoadingForm } = await import('./DemoForm');
    fetchMock.mockResolvedValue(answer(202));
    const { container } = render(
      <LoadingForm
        variant="school"
        to="support@quad-edu.com"
        labels={labels('school')}
        cheer={null}
        mode="endpoint"
        turnstile={{ dummyToken: DUMMY }}
        sendLabels={sendLabels('school')}
      />,
    );
    await fillSchool();
    const form = container.querySelector('form');
    if (form === null) throw new Error('No form.');
    fireEvent.submit(form);
    fireEvent.submit(form);

    release();
    expect(await screen.findByRole('status')).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('DemoForm before launch (the email form, D30)', () => {
  it('has no honeypot, no Turnstile and the old privacy line', () => {
    renderForm('school');
    expect(screen.queryByLabelText('Leave this empty')).toBeNull();
    expect(screen.queryByText(/Turnstile/)).toBeNull();
    expect(screen.getByText('We’ll only use this to arrange a walkthrough.')).toBeVisible();
  });
});
