import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { ARTICLE_PAGES } from '../_lib/public-pages';

import { Footer, FOOTER_LINKS } from './Footer';

// jsdom has <dialog> but not its modal methods; this behaves like the browser's for the test.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
});

describe('Footer', () => {
  it('groups the links in four cards: Explore, For schools, Company and Legal (D43)', () => {
    render(<Footer prelaunch={false} />);
    const nav = screen.getByRole('navigation', { name: 'About Quad' });
    const titles = within(nav).getAllByRole('heading', { level: 2 });
    expect(titles.map((title) => title.textContent)).toEqual([
      'Explore',
      'For schools',
      'Company',
      'Legal',
    ]);
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['The circle', '#circle'],
      ['Wellbeing', '#wellbeing'],
      ['Modules', '#more'],
      ['In the app', '#more'],
      ['Book a demo', '#demo'],
      ['Security & trust', '/security'],
      ['About', '/about'],
      ['support@quad-edu.com', 'mailto:support@quad-edu.com'],
      ['Privacy', '/legal/privacy'],
      ['Terms', '/legal/terms'],
    ]);
    expect(within(nav).getByText('Colombo, Sri Lanka')).toBeInTheDocument();
    // Sign in opens the sign-in dialog on the live site (D57).
    expect(within(nav).getByRole('button', { name: 'Sign in' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
  });

  it('opens the coming-soon note from Sign in before launch, instead of linking the portal', async () => {
    render(<Footer prelaunch />);
    const nav = screen.getByRole('navigation', { name: 'About Quad' });
    expect(within(nav).queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(nav.querySelector('a[href="/app"]')).toBeNull();
    const signIn = within(nav).getByRole('button', { name: 'Sign in' });
    expect(signIn).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(signIn);
    const note = screen.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
    expect(note).toHaveAttribute('open');
    expect(within(note).getByRole('link', { name: 'Book a demo' })).toHaveAttribute(
      'href',
      '#demo',
    );
  });

  it('sends the note’s Book a demo to the landing page from the other pages', async () => {
    render(<Footer homeHref="/" prelaunch />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const note = screen.getByRole('dialog', { name: 'Sign-in opens when schools go live' });
    expect(within(note).getByRole('link', { name: 'Book a demo' })).toHaveAttribute(
      'href',
      '/#demo',
    );
  });

  it('sends the landing-page links back to the landing page from the other pages', () => {
    render(<Footer homeHref="/" prelaunch={false} />);
    const nav = screen.getByRole('navigation', { name: 'About Quad' });
    expect(within(nav).getByRole('link', { name: 'The circle' })).toHaveAttribute(
      'href',
      '/#circle',
    );
    expect(within(nav).getByRole('link', { name: 'Book a demo' })).toHaveAttribute(
      'href',
      '/#demo',
    );
    expect(within(nav).getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
  });

  it('links to a page for each of the About, Security & trust and legal pages', () => {
    expect(FOOTER_LINKS.map((link) => link.href)).toEqual(ARTICLE_PAGES.map((page) => page.path));
  });

  it('names the company and says the sample people are fictional', () => {
    render(<Footer prelaunch={false} />);
    expect(
      screen.getByText(
        `© ${new Date().getFullYear()} Quad Education Pvt Limited (registration in progress)`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Sample school and families are fictional.')).toBeInTheDocument();
  });

  it('sends the logo to the top of the landing page, or home from other pages', () => {
    const { unmount } = render(<Footer prelaunch={false} />);
    expect(screen.getByRole('link', { name: 'Quad home' })).toHaveAttribute('href', '#top');
    unmount();
    render(<Footer homeHref="/" prelaunch={false} />);
    expect(screen.getByRole('link', { name: 'Quad home' })).toHaveAttribute('href', '/');
  });
});
