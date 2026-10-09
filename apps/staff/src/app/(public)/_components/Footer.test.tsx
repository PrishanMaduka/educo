import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ARTICLE_PAGES } from '../_lib/public-pages';

import { Footer, FOOTER_LINKS } from './Footer';

describe('Footer', () => {
  it('links to About, Security & trust, Privacy, Terms and Sub-processors (D41)', () => {
    render(<Footer />);
    const nav = screen.getByRole('navigation', { name: 'About Quad' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['About', '/about'],
      ['Security & trust', '/security'],
      ['Privacy', '/legal/privacy'],
      ['Terms', '/legal/terms'],
      ['Sub-processors', '/legal/subprocessors'],
    ]);
  });

  it('links to a page for each of the About, Security & trust and legal pages', () => {
    expect(FOOTER_LINKS.map((link) => link.href)).toEqual(ARTICLE_PAGES.map((page) => page.path));
  });

  it('keeps the contact address and says the sample people are fictional', () => {
    render(<Footer />);
    expect(screen.getByText('Contact', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      'mailto:support@quad-edu.com',
    );
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
