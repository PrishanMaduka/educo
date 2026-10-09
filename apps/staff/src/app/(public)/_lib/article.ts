import type { ReactNode } from 'react';

/** The line drawings a soft badge can show (`SoftBadge` maps each to its lucide icon). */
export type BadgeIcon =
  | 'alert'
  | 'audit'
  | 'box'
  | 'calendar'
  | 'cap'
  | 'card'
  | 'chat'
  | 'clock'
  | 'code'
  | 'cookie'
  | 'cross'
  | 'doc'
  | 'door'
  | 'family'
  | 'flag'
  | 'globe'
  | 'heart'
  | 'key'
  | 'lock'
  | 'mail'
  | 'phone'
  | 'pin'
  | 'power'
  | 'rule'
  | 'scale'
  | 'school'
  | 'screen'
  | 'server'
  | 'shield'
  | 'spark'
  | 'swap'
  | 'tiles'
  | 'user';

/** The four colours of the Quad mark; cards and badges take one each (design/pages.html, D45). */
export type Tint = 'sky' | 'pink' | 'lime' | 'orange';

/** One of the apps on the About page's "What Quad is" card, on a card in its own colour. */
export interface AppCard {
  name: string;
  icon: BadgeIcon;
  tint: Tint;
  text: string;
}

/** One step on the About page's "Where we are now" timeline. */
export interface TimelineStep {
  /** "Started", "Now" or "Next". */
  when: string;
  title: string;
  text: string;
  /** Steps already taken are filled; the current step is marked "now". */
  state: 'done' | 'now' | 'next';
}

/** One section of an About, Security & trust or legal page; `id` is its anchor. */
export interface ArticleSection {
  id: string;
  title: string;
  /** The section's full text. It is always shown (on Security & trust, under "The detail"). */
  body: ReactNode;
  /** The drawing on the section's soft badge. */
  icon?: BadgeIcon;
  /** The badge colour; by default the page takes the four colours in turn. */
  tone?: Tint | 'plain';
  /** A tinted card in one of the mark's colours instead of the white card. */
  tint?: Tint;
  /** Security & trust: the one-line promise above "The detail". */
  promise?: string;
  /** About: the card takes half the row from 900 px up (two in a row). */
  isHalf?: boolean;
  /** Security & trust: the full-width navy card at the end ("Report a security issue"). */
  isCallout?: boolean;
  /** About, "What Quad is": the three apps on vivid cards under the text. */
  apps?: readonly AppCard[];
  /** A line after the apps with its own badge (Ask Quad). */
  aside?: { icon: BadgeIcon; tone: Tint; text: ReactNode };
  /** About, "Where we are now": the steps, shown above the text. */
  timeline?: readonly TimelineStep[];
  /** About, "Who's behind Quad": the person, shown with an initials avatar beside the text. */
  person?: { name: string; role: string };
  /** Short facts shown as chips under the text. */
  facts?: readonly string[];
  /** A button under the text (About, "Talk to us"). */
  cta?: { href: string; label: string };
}

/**
 * A public page's text (D41): typed content in `apps/staff/content/`, rendered by `ArticlePage`
 * in design option A, "Story cards" (D45). `summary` is the story-first sentence under the heading.
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
  /**
   * How the sections are laid out: `story` (About: cards of different sizes), `promises`
   * (Security & trust: a grid of tinted cards, each a promise with the detail under it) or
   * `legal` (an "In short" card, then one card per section beside an "On this page" list).
   */
  layout: 'story' | 'promises' | 'legal';
  /** Legal pages: the points of the page in a sentence each, shown first under "In short". */
  inShort?: readonly ReactNode[];
  sections: readonly ArticleSection[];
}
