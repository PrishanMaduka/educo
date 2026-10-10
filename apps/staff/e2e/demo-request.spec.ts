import { expect, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, expectNoSideScroll } from '@quad/config/playwright/checks';
import { Mailpit } from '@quad/config/playwright/mailpit';
import { test } from '@quad/config/playwright/stack';

/*
 * The demo forms on the live landing page (spec 19 "Demo requests", D57): a valid request goes to
 * `POST /api/v1/public/demo-requests` on the e2e stack, which emails sales and the requester
 * through Mailpit. The build has no Turnstile site key, so the form sends the dummy token the
 * stack's local verifier accepts and nothing is loaded from Cloudflare. Each test is its own
 * client (`x-forwarded-for`), so the 5-an-hour limit per IP is never shared. The pre-launch
 * export's email form is `landing.spec.ts`'s.
 */

/** An address no other run or project uses, so Mailpit finds this test's email. */
function requesterEmail(project: string, retry: number): string {
  const run = `${project}-${String(retry)}-${String(Date.now())}`.replace(/[^a-z0-9-]/gi, '');
  return `demo+${run}@example.test`;
}

/** Records every request to Cloudflare's Turnstile host. */
function cloudflareRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'challenges.cloudflare.com') seen.push(request.url());
  });
  return seen;
}

test.describe('demo requests on the live landing page', () => {
  test('a school’s request reaches Quad, and the requester gets an email', async ({
    page,
  }, testInfo) => {
    const cloudflare = cloudflareRequests(page);
    const email = requesterEmail(testInfo.project.name, testInfo.retry);
    const since = new Date(Date.now() - 1000);
    await page.goto('/#demo');
    const form = page.locator('#demo form').filter({ visible: true });
    await expect(form.getByText(/Protected by Cloudflare Turnstile/)).toBeVisible();
    await expect(form.getByRole('link', { name: 'privacy policy' })).toHaveAttribute(
      'href',
      '/legal/privacy#website',
    );

    await form.getByLabel('Your name').fill('Sample Person');
    await form.getByLabel('Work email').fill(email);
    await form.getByLabel('School').fill('Sample School');
    await form.getByLabel('Students').selectOption('300_1000');
    const posted = page.waitForRequest('**/api/v1/public/demo-requests');
    await form.getByRole('button', { name: /Request a demo/ }).click();

    const body: unknown = (await posted).postDataJSON();
    expect(body).toMatchObject({ kind: 'school', email, website: '' });
    const done = page.locator('#demo').getByRole('status').filter({ visible: true });
    await expect(done).toContainText(
      'Thank you. We’ll email you within one working day to find a time.',
    );
    await expect(done.getByRole('heading')).toBeFocused();
    await expectNoSideScroll(page);
    await expectNoSeriousA11yViolations(page);

    const confirmation = await new Mailpit().waitForMessage({ to: email, since });
    expect(confirmation.subject).toBe('We’ve got your demo request');
    expect(cloudflare).toEqual([]);
  });

  test('a parent’s request reaches Quad as a parent’s', async ({ page }, testInfo) => {
    const email = requesterEmail(testInfo.project.name, testInfo.retry);
    const since = new Date(Date.now() - 1000);
    await page.goto('/?view=parent#demo');
    const form = page.locator('#demo form').filter({ visible: true });
    await form.getByLabel('Your name').fill('Sample Parent');
    await form.getByLabel('Your email').fill(email);
    await form.getByLabel('Your child’s school').fill('Sample School');
    await form.getByLabel(/A note to the school/).fill('We would love it.');
    await form.getByRole('button', { name: /Send to my school/ }).click();

    await expect(page.locator('#demo').getByRole('status').filter({ visible: true })).toContainText(
      'Thank you. We’ll get in touch with your child’s school.',
    );
    const confirmation = await new Mailpit().waitForMessage({ to: email, since });
    expect(confirmation.subject).toBe('We’ve got your message about your child’s school');
  });

  test('when Quad cannot take it, the request is offered as an email', async ({ page }) => {
    await page.route('**/api/v1/public/demo-requests', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'captcha_unavailable', message: 'Unavailable' }),
      }),
    );
    await page.goto('/#demo');
    const form = page.locator('#demo form').filter({ visible: true });
    await form.getByLabel('Your name').fill('Sample Person');
    await form.getByLabel('Work email').fill('name@school.org');
    await form.getByLabel('School').fill('Sample School');
    await form.getByRole('button', { name: /Request a demo/ }).click();

    await expect(form.getByRole('alert')).toHaveText(
      'We couldn’t send your request just now. Try again in a minute, or email support@quad-edu.com.',
    );
    const link = form.getByRole('alert').getByRole('link', { name: 'support@quad-edu.com' });
    const mail = new URL((await link.getAttribute('href')) ?? '');
    expect(mail.protocol).toBe('mailto:');
    expect(mail.searchParams.get('subject')).toBe('Demo request: Sample School');
    await expect(form.getByRole('button', { name: /Request a demo/ })).toBeEnabled();
  });
});
