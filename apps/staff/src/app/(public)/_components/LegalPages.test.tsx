import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

import { QUAD_COOKIES, type QuadCookie } from '@quad/contracts/cookies';
import { within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { cookiesPage } from '../../../../content/legal/cookies';
import { dpaPage } from '../../../../content/legal/dpa';
import { privacyPage } from '../../../../content/legal/privacy';
import { termsPage } from '../../../../content/legal/terms';
import { COMPANY } from '../_lib/company';

import { ArticlePage } from './ArticlePage';

import type { ArticleContent } from '../_lib/article';

/*
 * The legal pages' content (spec 19 "Legal pages", D41, D44, D57): the DPA draft, the Cookies
 * page rendered from the cookie registry, and the privacy policy's analytics and sub-processors.
 */

// Vitest runs in apps/staff (under jsdom, import.meta.url is not a file URL).
const app = process.cwd();

/** Renders a page as the server does and returns its `<main>`. */
function renderPage(content: ArticleContent): HTMLElement {
  document.body.innerHTML = renderToStaticMarkup(<ArticlePage content={content} />);
  const main = document.querySelector('main');
  if (!main) throw new Error('The page has no <main>');
  return main;
}

/** A section's card, found by its anchor. */
function sectionCard(id: string): HTMLElement {
  const card = document.getElementById(id)?.closest('section');
  if (!(card instanceof HTMLElement)) throw new Error(`No section #${id}`);
  return card;
}

/** The name a visitor sees in their browser outside local: `__Host-` where the cookie has it. */
const shownName = (item: QuadCookie) =>
  item.hostPrefixed ? (item.names.find((name) => name.startsWith('__Host-')) ?? '') : item.label;

/** Every source file under `dir` (skipping the landing page's art). */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_art') ? [] : sources(path);
    return /\.(tsx?|json)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('legal pages (spec 19, D41)', () => {
  it.each([
    ['/legal/privacy', privacyPage, '0.3'],
    ['/legal/terms', termsPage, '0.1'],
    ['/legal/dpa', dpaPage, '0.1'],
    ['/legal/cookies', cookiesPage, '0.1'],
  ] as const)('%s shows when it last changed and its version', (path, content, version) => {
    expect(content.path).toBe(path);
    expect(content.updated?.version).toBe(version);
    const main = renderPage(content);
    expect(main.querySelector('header')).toHaveTextContent(
      new RegExp(`Last updated \\d{1,2} \\w+ 20\\d\\d · Version ${version.replace('.', '\\.')}`),
    );
  });

  it('no page, content file or public string mentions Plausible (owner, OQ3)', () => {
    const files = [
      ...sources(join(app, 'src/app/(public)')),
      ...sources(join(app, 'content')),
      join(app, '../../packages/contracts/i18n/en.json'),
    ];
    expect(files.some((file) => file.endsWith('legal/privacy.tsx'))).toBe(true);
    const offenders = files.filter((file) => /plausible/i.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => relative(app, file))).toEqual([]);
  });
});

describe('/legal/dpa', () => {
  it('says at the top that it is a draft that needs legal review before launch (OQ6)', () => {
    const main = renderPage(dpaPage);
    const header = main.querySelector('header');
    expect(header).toHaveTextContent('Draft, version 0.1: this needs legal review before launch');
    expect(readFileSync(join(app, 'content/legal/dpa.tsx'), 'utf8')).toMatch(
      /NEEDS LEGAL REVIEW BEFORE LAUNCH/,
    );
  });

  it('covers what spec 19 asks of it, with the facts from the company module', () => {
    const main = renderPage(dpaPage);
    const text = main.textContent;
    expect(text).toContain('controller');
    expect(text).toContain('processor');
    expect(text).toContain('72 hours');
    expect(text).toContain('30 days');
    expect(text).toContain('35 days');
    expect(text).toContain('ap-south-1');
    expect(text).toContain('Personal Data Protection Act');
    expect(text).toContain('GDPR');
    expect(text).toContain(COMPANY.governingLaw);
    expect(text).toContain(COMPANY.legalName);
    expect(within(main).getAllByRole('link', { name: COMPANY.contact.support })[0]).toHaveAttribute(
      'href',
      `mailto:${COMPANY.contact.support}`,
    );
    expect(
      within(sectionCard('security')).getByRole('link', { name: 'Security & trust' }),
    ).toHaveAttribute('href', '/security');
    expect(
      within(sectionCard('subprocessors')).getByRole('link', { name: /privacy policy/ }),
    ).toHaveAttribute('href', '/legal/privacy#subprocessors');
  });

  it('claims no certification and calls the penetration test planned (D41)', () => {
    const text = renderPage(dpaPage).textContent;
    expect(text).not.toMatch(/\b(ISO ?27001|SOC ?2|certified by|is certified)\b/i);
    expect(text).toMatch(/penetration test is planned/);
  });
});

describe('/legal/cookies', () => {
  it('lists every cookie and storage key in the registry, so it cannot drift from the code', () => {
    renderPage(cookiesPage);
    const groups = {
      necessary: within(sectionCard('necessary')),
      storage: within(sectionCard('storage')),
      analytics: within(sectionCard('analytics')),
    };
    for (const item of QUAD_COOKIES) {
      const group =
        item.category === 'analytics'
          ? groups.analytics
          : item.kind === 'local_storage'
            ? groups.storage
            : groups.necessary;
      const card = group.getByRole('heading', { level: 3, name: shownName(item) }).closest('li');
      if (!(card instanceof HTMLElement)) throw new Error(`No card for ${item.id}`);
      expect(card).toHaveTextContent(item.purpose);
      expect(card).toHaveTextContent(item.lifetime);
      if (item.kind === 'cookie') expect(card).toHaveTextContent(item.host);
    }
    expect(document.getElementById('necessary')).toHaveTextContent('Strictly necessary');
  });

  it('puts _ga and _ga_<id> under "only if you accept", set on the public website only', () => {
    renderPage(cookiesPage);
    const analytics = sectionCard('analytics');
    expect(document.getElementById('analytics')).toHaveTextContent(/only if you accept/i);
    expect(
      within(analytics)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['_ga', '_ga_<id>']);
    expect(analytics).toHaveTextContent('Google signals and ads personalisation are off');
    expect(analytics).toHaveTextContent('2 months');
    expect(analytics).toHaveTextContent(/never in the Quad apps/);
    expect(within(sectionCard('necessary')).queryByText('_ga')).toBeNull();
  });

  it('says how to withdraw, what Turnstile stores, and that there are no advertising cookies', () => {
    const main = renderPage(cookiesPage);
    expect(main).toHaveTextContent(
      'Choose Reject in Cookie settings; we delete the analytics cookies at once.',
    );
    expect(sectionCard('turnstile')).toHaveTextContent('challenges.cloudflare.com');
    expect(sectionCard('turnstile')).toHaveTextContent(/no cookie and nothing in storage/);
    expect(main).toHaveTextContent(/no advertising cookies/i);
  });
});

describe('/legal/privacy 0.3', () => {
  it('names Google Analytics, by Google Ireland Limited and Google LLC, for site visitors (D44)', () => {
    renderPage(privacyPage);
    const list = within(sectionCard('subprocessors'));
    const card = list.getByRole('heading', { level: 3, name: 'Google Analytics' }).closest('li');
    expect(card).toHaveTextContent('Google Ireland Limited');
    expect(card).toHaveTextContent('Google LLC');
    expect(card).toHaveTextContent('Website visit counts, only if you accept analytics cookies');
    expect(card).toHaveTextContent(
      'Cookie id, pages viewed, device and browser, approximate location',
    );
    expect(card).toHaveTextContent('United States and global');
    // Listed for this website, where Quad decides, not among the processors of school data.
    expect(
      within(sectionCard('subprocessors')).getByRole('list', { name: 'Sub-processors' }),
    ).not.toContainElement(card);
  });

  it('describes the demo forms, parent requests and analytics as they now work', () => {
    renderPage(privacyPage);
    const website = sectionCard('website');
    expect(website).toHaveTextContent(
      'the form sends your request to us (before launch, it opened an email instead)',
    );
    expect(website).toHaveTextContent('Cloudflare Turnstile');
    expect(website).toHaveTextContent(
      'When you ask us to tell your school about Quad, our team gets in touch with the school. We don’t email the school automatically, and we never contact other families.',
    );
    expect(website).toHaveTextContent(
      'If you accept analytics cookies, we use Google Analytics to count visits to this website. We don’t send your name or email to Google, and you can change your choice at any time in Cookie settings.',
    );
  });

  it('sums up cookies and links the cookie notice, calling the theme browser storage', () => {
    renderPage(privacyPage);
    const cookies = sectionCard('cookies');
    expect(within(cookies).getByRole('link', { name: /cookie notice/i })).toHaveAttribute(
      'href',
      '/legal/cookies',
    );
    expect(cookies).not.toHaveTextContent('quad_theme');
    expect(document.querySelector('main')).not.toHaveTextContent(/no cookie banner/i);
  });
});
