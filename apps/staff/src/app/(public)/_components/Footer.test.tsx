import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ARTICLE_PAGES } from '../_lib/public-pages';

import { Footer, FOOTER_LINKS } from './Footer';

describe('Footer', () => {
  it('groups the links in four cards: Explore, For schools, Company and Legal (D43)', () => {
    render(<Footer />);
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
      ['Sign in', '/app'],
      ['Security & trust', '/security'],
      ['About', '/about'],
      ['support@quad-edu.com', 'mailto:support@quad-edu.com'],
      ['Privacy', '/legal/privacy'],
      ['Terms', '/legal/terms'],
      ['Sub-processors', '/legal/subprocessors'],
    ]);
    expect(within(nav).getByText('Colombo, Sri Lanka')).toBeInTheDocument();
  });

  it('sends the landing-page links back to the landing page from the other pages', () => {
    render(<Footer homeHref="/" />);
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
    render(<Footer />);
    expect(
      screen.getByText(
        `© ${new Date().getFullYear()} Quad Education Pvt Limited (registration in progress)`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Sample school and families are fictional.')).toBeInTheDocument();
  });

  it('sends the logo to the top of the landing page, or home from other pages', () => {
    const { unmount } = render(<Footer />);
    expect(screen.getByRole('link', { name: 'Quad home' })).toHaveAttribute('href', '#top');
    unmount();
    render(<Footer homeHref="/" />);
    expect(screen.getByRole('link', { name: 'Quad home' })).toHaveAttribute('href', '/');
  });
});
