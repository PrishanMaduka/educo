import type { ReactNode } from 'react';

/** One section of an About, Security & trust or legal page; `id` is its anchor. */
export interface ArticleSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * A public page's text (D41): typed content in `apps/staff/content/`, rendered by `ArticlePage`.
 * `summary` is the story-first sentence under the heading.
 */
export interface ArticleContent {
  /** The page's path without a trailing slash, for the canonical URL and the sitemap. */
  path: string;
  eyebrow: string;
  title: string;
  summary: string;
  /** The `<title>`, e.g. "Privacy policy – Quad". */
  metaTitle: string;
  /** The meta description (155 characters or fewer, spec 19 SEO). */
  description: string;
  /** Legal pages carry the date they last changed (`YYYY-MM-DD`) and a version. */
  updated?: { date: string; version: string };
  /** Long pages list their sections under "On this page". */
  hasContents?: boolean;
  /** Pages with a table use the full column; paragraphs keep the readable measure. */
  isWide?: boolean;
  sections: readonly ArticleSection[];
}
