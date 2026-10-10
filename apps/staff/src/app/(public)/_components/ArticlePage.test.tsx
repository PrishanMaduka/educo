import { within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { aboutPage } from '../../../../content/about';
import { cookiesPage } from '../../../../content/legal/cookies';
import { dpaPage } from '../../../../content/legal/dpa';
import { privacyPage } from '../../../../content/legal/privacy';
import { termsPage } from '../../../../content/legal/terms';
import { securityPage } from '../../../../content/security';
import { ARTICLE_PAGES } from '../_lib/public-pages';

import { ArticlePage } from './ArticlePage';

import type { ArticleContent } from '../_lib/article';

/** Renders a page as the server does (it is a server component) and returns its `<main>`. */
function renderPage(content: ArticleContent) {
  document.body.innerHTML = renderToStaticMarkup(<ArticlePage content={content} />);
  const main = document.querySelector('main');
  if (!main) throw new Error('The page has no <main>');
  return within(main);
}

/** A section's heading and card, found by its anchor (role queries over a whole page are slow). */
function sectionOf(id: string) {
  const heading = document.getElementById(id);
  const card = heading?.closest('section');
  if (!heading || !(card instanceof HTMLElement)) throw new Error(`No section #${id}`);
  return { heading, card };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ArticlePage, option A "Story cards" (D45)', () => {
  it.each(ARTICLE_PAGES.map((page) => [page.path, page] as const))(
    '%s has one <h1> and a self-linking heading for every section',
    (_path, content) => {
      renderPage(content);
      expect(document.querySelectorAll('h1')).toHaveLength(1);
      for (const section of content.sections) {
        const { heading, card } = sectionOf(section.id);
        expect(heading.tagName).toBe('H2');
        expect(heading.textContent).toContain(section.title);
        expect(heading.querySelector('a')).toHaveAttribute('href', `#${section.id}`);
        expect(card).toHaveAttribute('aria-labelledby', section.id);
      }
    },
  );

  it('marks the page in the top bar and draws the big mark only as decoration', () => {
    renderPage(privacyPage);
    const bar = within(document.body).getByRole('navigation', { name: 'Pages' });
    expect(within(bar).getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(bar).getByRole('link', { name: 'Terms' })).not.toHaveAttribute('aria-current');
    const marks = [...document.querySelectorAll('main > header svg')];
    expect(marks).toHaveLength(2);
    for (const mark of marks) expect(mark.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('About shows the three apps on cards, the timeline and the founder card', () => {
    const main = renderPage(aboutPage);
    const what = sectionOf('what').card;
    expect(
      within(what)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['The staff portal', 'The Quad app for parents', 'The platform console']);
    expect(within(what).getByText(/^In each app, Ask Quad answers questions/)).toBeVisible();

    const stage = sectionOf('stage').card;
    const steps = within(stage).getAllByRole('listitem');
    expect(steps.map((step) => step.querySelector('b')?.textContent)).toEqual([
      'Founded in 2026',
      'In development',
      'Pilots with schools',
    ]);

    expect(main.getByRole('heading', { level: 3, name: 'Prishan Maduka' })).toBeVisible();
    expect(main.getByRole('link', { name: /Book a 30-minute demo/ })).toHaveAttribute(
      'href',
      '/#demo',
    );
  });

  it('Security & trust gives each section a promise with the full text under "The detail"', () => {
    renderPage(securityPage);
    for (const section of securityPage.sections) {
      const { card } = sectionOf(section.id);
      if (section.isCallout) {
        expect(card.querySelector('details')).toBeNull();
        continue;
      }
      expect(section.promise).toBeTruthy();
      expect(within(card).getByText(section.promise ?? '')).toBeVisible();
      const details = card.querySelector('details');
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute('open');
      expect(details?.querySelector('summary')?.textContent).toMatch(
        new RegExp(`^The detail: ${section.title}`),
      );
    }
    const report = sectionOf('report').card;
    expect(report).toHaveTextContent('Report a security issue');
    expect(within(report).getByRole('link', { name: 'support@quad-edu.com' })).toBeVisible();
  });

  it.each([
    ['/legal/privacy', privacyPage],
    ['/legal/terms', termsPage],
    ['/legal/dpa', dpaPage],
    ['/legal/cookies', cookiesPage],
  ] as const)(
    '%s opens with "In short", then lists every section under "On this page"',
    (_path, content) => {
      renderPage(content);
      const inShort = sectionOf('in-short').card;
      expect(inShort).toHaveTextContent(/^In short/);
      expect(within(inShort).getAllByRole('listitem')).toHaveLength(content.inShort?.length ?? 0);
      expect(content.inShort?.length).toBe(6);

      const contents = document.querySelector('nav[aria-labelledby="contents-title"]');
      if (!(contents instanceof HTMLElement)) throw new Error('No "On this page" list');
      expect(document.getElementById('contents-title')).toHaveTextContent('On this page');
      expect(
        [...contents.querySelectorAll('a')].map((link) => [
          link.textContent,
          link.getAttribute('href'),
        ]),
      ).toEqual(content.sections.map((section) => [section.title, `#${section.id}`]));
      expect(contents.className).toContain('min-[1101px]:sticky');
      expect(document.querySelector('main h2')).toHaveTextContent('In short');
    },
  );
});
