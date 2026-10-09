import { describe, expect, it } from 'vitest';

import { EmbedKeyParams, EnquiryInput } from '../index';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

const enquiry = {
  parentName: 'Dilani Perera',
  email: 'dilani@example.test',
  phone: '+94 77 123 4567',
  childName: 'Amaya Perera',
  message: 'We are moving to Colombo in January.',
};

describe('EnquiryInput (POST /public/enquiry/:embedKey)', () => {
  it('takes a parent, an address, and optionally a phone, the child and a message', () => {
    expect(EnquiryInput.safeParse(enquiry).success).toBe(true);
    expect(
      EnquiryInput.safeParse({ parentName: 'Dilani Perera', email: 'dilani@example.test' }).success,
    ).toBe(true);
  });

  it.each([
    [{ parentName: ' ' }, ['parentName']],
    [{ email: 'not-an-address' }, ['email']],
    [{ phone: 'x'.repeat(41) }, ['phone']],
    [{ message: 'x'.repeat(2001) }, ['message']],
    [{ tenantId: '0192a6f4-1b2c-7d3e-8f40-123456789abd' }, []],
  ])('refuses %j at its path', (change, path) => {
    expect(pathOf(EnquiryInput.safeParse({ ...enquiry, ...change }))).toEqual(path);
  });
});

describe('EmbedKeyParams', () => {
  it('takes a key of 8 to 64 URL-safe characters', () => {
    expect(EmbedKeyParams.safeParse({ embedKey: 'cis-2026_admissions' }).success).toBe(true);
    expect(pathOf(EmbedKeyParams.safeParse({ embedKey: 'short' }))).toEqual(['embedKey']);
    expect(pathOf(EmbedKeyParams.safeParse({ embedKey: 'bad key!' }))).toEqual(['embedKey']);
  });
});
