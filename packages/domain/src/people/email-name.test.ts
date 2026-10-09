import { describe, expect, it } from 'vitest';

import { maskEmail, nameFromEmail } from './email-name';

describe('nameFromEmail (the prototype names an invitee from their address)', () => {
  it.each([
    ['nadeesha.jayasinghe@colombo-intl.local', 'Nadeesha Jayasinghe'],
    ['ruwan_mendis@quad.local', 'Ruwan Mendis'],
    ['amaya@school.example', 'Amaya'],
    ['  j.perera@school.example ', 'J Perera'],
    ['a..b@school.example', 'A B'],
    ['kamal.silva', 'Kamal Silva'],
  ])('%j gives %j', (email, expected) => {
    expect(nameFromEmail(email)).toBe(expected);
  });

  it('falls back to the whole local part when it has no letters to split on', () => {
    expect(nameFromEmail('._@school.example')).toBe('._');
  });
});

describe('maskEmail (an invite page shows whose invite it is without the full address)', () => {
  it.each([
    ['nadeesha.jayasinghe@colombo-intl.local', 'n•••@colombo-intl.local'],
    ['a@school.example', 'a•••@school.example'],
    ['Ruwan@Quad.Local', 'r•••@quad.local'],
  ])('%j gives %j', (email, expected) => {
    expect(maskEmail(email)).toBe(expected);
  });

  it('never shows more than the first character of the local part', () => {
    const masked = maskEmail('secretname@school.example');
    expect(masked).not.toContain('ecret');
  });

  it('masks an address without an @ completely', () => {
    expect(maskEmail('not-an-address')).toBe('•••');
  });
});
