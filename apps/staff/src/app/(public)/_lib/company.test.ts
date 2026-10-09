import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';

import { render } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { describe, expect, it } from 'vitest';

import { COMPANY, TO_BE_CONFIRMED, unconfirmedFields } from './company';
import { ARTICLE_PAGES, PUBLIC_PATHS } from './public-pages';

// Vitest runs in apps/staff (under jsdom, import.meta.url is not a file URL).
const app = process.cwd();

/** Source files of the public site: the (public) route group and the page content. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_art') ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

const pageText = (index: number) =>
  render(
    createElement(
      Fragment,
      null,
      ...(ARTICLE_PAGES[index]?.sections.map((section) => section.body) ?? []),
    ),
  ).container.textContent;

describe('company facts (D41)', () => {
  it('lists the placeholders the owner still has to confirm', () => {
    expect(unconfirmedFields()).toEqual(['registeredAddress', 'founder.bio']);
    expect(COMPANY.founder.name).toBe('Prishan Maduka');
    expect(COMPANY.country).toBe('Sri Lanka');
  });

  it('are written only in the company module', () => {
    const facts = [
      COMPANY.founder.name,
      COMPANY.contact.support,
      COMPANY.contact.privacy,
      COMPANY.contact.security,
      TO_BE_CONFIRMED,
    ];
    const files = [
      ...sources(join(app, 'src/app/(public)')),
      ...sources(join(app, 'content')),
    ].filter((file) => !file.endsWith('company.ts'));
    expect(files.some((file) => file.endsWith('legal/terms.tsx'))).toBe(true);
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return facts
        .filter((fact) => text.includes(fact))
        .map((fact) => `${relative(app, file)}: ${fact}`);
    });
    expect(offenders).toEqual([]);
  });

  it('reach the pages that show them', () => {
    const [about, security, privacy, terms] = [0, 1, 2, 3].map(pageText);
    expect(about).toContain(COMPANY.founder.name);
    expect(about).toContain(COMPANY.founder.bio);
    expect(about).toContain(COMPANY.legalName);
    expect(about).toContain(COMPANY.contact.support);
    expect(security).toContain(COMPANY.contact.security);
    expect(privacy).toContain(COMPANY.contact.privacy);
    expect(privacy).toContain(COMPANY.registeredAddress);
    expect(terms).toContain(COMPANY.governingLaw);
    expect(terms).toContain(COMPANY.liabilityCap);
    expect(terms).toContain(COMPANY.legalName);
  });
});

describe('public pages', () => {
  it('are in the sitemap', () => {
    expect(PUBLIC_PATHS).toEqual([
      '/',
      '/about',
      '/security',
      '/legal/privacy',
      '/legal/terms',
      '/legal/subprocessors',
    ]);
  });

  it('each open with one plain sentence and a meta description of 155 characters or fewer', () => {
    for (const page of ARTICLE_PAGES) {
      expect(page.summary).toMatch(/^[A-Z].*\.$/);
      expect(page.description.length).toBeLessThanOrEqual(155);
    }
  });

  it('give each section a unique anchor', () => {
    for (const page of ARTICLE_PAGES) {
      const ids = page.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
