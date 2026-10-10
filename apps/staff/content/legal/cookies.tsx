/*
 * The cookie notice at /legal/cookies (spec 19 "Legal pages", D57), version 0.1. Its cards are
 * rendered from `QUAD_COOKIES`, the one registry the API, the web apps and the cookie audit
 * (e2e/cookie-audit.spec.ts) also read, so the page cannot drift from the code. Google Analytics
 * is the only cookie that needs consent (owner, OQ3); the banner and the Cookie settings button
 * that reopens it come with Google Analytics (M1b Task 13). Cloudflare Turnstile sets nothing on
 * our site (OQ-T6, D57).
 */
import { QUAD_COOKIES, type QuadCookie } from '@quad/contracts/cookies';
import Link from 'next/link';

import { COMPANY } from '../../src/app/(public)/_lib/company';

import { FactCards } from './fact-cards';

import type { ArticleContent } from '../../src/app/(public)/_lib/article';

const contact = COMPANY.contact.privacy;
const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

/** The name a visitor finds in their browser: outside local, `__Host-` where the cookie has it. */
function shownName(item: QuadCookie): string {
  if (!item.hostPrefixed) return item.label;
  return item.names.find((name) => name.startsWith('__Host-')) ?? item.label;
}

/** One card per registry entry in the group, with what it does, how long it stays and where. */
function CookieCards({ label, items }: { label: string; items: readonly QuadCookie[] }) {
  return (
    <FactCards
      label={label}
      cards={items.map((item) => ({
        title: shownName(item),
        facts: [
          ['What it does', item.purpose],
          ['How long', item.lifetime],
          [
            item.kind === 'cookie' ? 'Set on' : 'Kept in',
            item.kind === 'cookie' ? item.host : 'Your browser, for this website',
          ],
        ],
      }))}
    />
  );
}

const necessaryCookies = QUAD_COOKIES.filter(
  (item) => item.category === 'necessary' && item.kind === 'cookie',
);
const storageKeys = QUAD_COOKIES.filter(
  (item) => item.category === 'necessary' && item.kind === 'local_storage',
);
const analyticsCookies = QUAD_COOKIES.filter((item) => item.category === 'analytics');

export const cookiesPage: ArticleContent = {
  path: '/legal/cookies',
  eyebrow: 'Legal',
  title: 'Cookie notice',
  metaTitle: 'Cookie notice – Quad',
  summary:
    'Quad sets only the cookies it needs to work, and this website uses analytics cookies only if you accept them.',
  description:
    'Every cookie and storage key Quad uses: what each does and how long it stays, Google Analytics only if you accept, and how to change your choice.',
  updated: { date: '2026-10-10', version: '0.1' },
  layout: 'legal',
  inShort: [
    'Quad sets only the cookies it needs to work, such as the one that keeps you signed in.',
    'A few choices, like light or dark mode, stay in your browser’s storage and never leave your device.',
    'Google Analytics cookies are set on this website only if you accept them, and never in the Quad apps.',
    'You can change your choice at any time; if you reject, we delete the analytics cookies at once.',
    'Cloudflare’s check on the demo form sets nothing on our site.',
    'There are no advertising cookies.',
  ],
  sections: [
    {
      id: 'what',
      title: 'Cookies and browser storage',
      icon: 'cookie',
      body: (
        <>
          <p>
            A cookie is a small file a website keeps in your browser and gets back on each visit.
            Browser storage is similar, but it stays on your device and is never sent to a server.
          </p>
          <p>
            This notice covers quad-edu.com, which is this website and the staff portal, and
            console.quad-edu.com, the console for Quad’s own team. The lists below come from the
            same list our code uses, so they show every cookie and storage key Quad sets.
          </p>
        </>
      ),
    },
    {
      id: 'necessary',
      title: 'Strictly necessary cookies',
      icon: 'lock',
      body: (
        <>
          <p>
            These keep you signed in and keep your account safe. Quad cannot work without them, so
            they need no consent. Most are set only when you sign in.
          </p>
          <CookieCards label="Strictly necessary cookies" items={necessaryCookies} />
        </>
      ),
    },
    {
      id: 'storage',
      title: 'Browser storage',
      icon: 'screen',
      body: (
        <>
          <p>
            These remember choices you make. They stay in your browser on this device and are never
            sent to us.
          </p>
          <CookieCards label="Browser storage" items={storageKeys} />
        </>
      ),
    },
    {
      id: 'analytics',
      title: 'Analytics cookies, only if you accept',
      icon: 'spark',
      body: (
        <>
          <p>
            If you accept analytics cookies, Google Analytics counts visits to this website. It runs
            on the public website only, never in the Quad apps. Until you choose Accept, nothing
            from Google loads and none of these cookies is set.
          </p>
          <CookieCards label="Analytics cookies" items={analyticsCookies} />
          <p>
            Google receives the pages you view, your device and browser, and an approximate location
            worked out from your IP address, which Google does not store. We never send your name or
            email to Google. Google signals and ads personalisation are off, and Google keeps the
            data for 2 months, the shortest time it offers.
          </p>
        </>
      ),
    },
    {
      id: 'choice',
      title: 'Changing your choice',
      icon: 'swap',
      body: (
        <>
          <p>
            When this website uses analytics, it asks first with a cookie banner, and Cookie
            settings at the foot of each page opens it again. Choose Reject in Cookie settings; we
            delete the analytics cookies at once.
          </p>
          <p>
            Your choice is kept for 12 months, and then we ask again. You can also delete cookies
            and storage in your browser’s settings at any time; you will need to sign in again.
          </p>
        </>
      ),
    },
    {
      id: 'turnstile',
      title: 'The check on the demo form',
      icon: 'shield',
      body: (
        <p>
          When you send a demo request, Cloudflare Turnstile checks that a person, not a bot, is
          sending it. Cloudflare runs the check in its own frame on challenges.cloudflare.com and
          sets no cookie and nothing in storage on quad-edu.com. What Cloudflare keeps for the check
          is on its own domain, under Cloudflare’s privacy policy. The{' '}
          <Link href="/legal/privacy#website">privacy policy</Link> says what it sees.
        </p>
      ),
    },
    {
      id: 'no-ads',
      title: 'No advertising cookies',
      icon: 'heart',
      body: (
        <p>
          There are no advertising cookies on this website or in the Quad apps. We don’t follow you
          across other websites, and we never sell data about visitors.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this notice',
      icon: 'calendar',
      body: (
        <p>
          We update this notice whenever a cookie changes. The date and version at the top show when
          it last changed.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: 'chat',
      body: <p>Questions about cookies go to {mail(contact)}.</p>,
    },
  ],
};
