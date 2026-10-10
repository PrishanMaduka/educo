import { describe, expect, it } from 'vitest';

import {
  DemoRequestBody,
  DemoRequestSchema,
  demoRequestProblem,
  SchoolIntroRequestSchema,
  schoolIntroProblem,
} from './demo-request';

const school = {
  name: 'Sample Person',
  email: 'name@school.org',
  school: 'Sample School',
  country: 'Portugal',
  students: '300_1000',
  curriculum: 'ib',
};

const parent = {
  name: 'Sample Parent',
  email: 'name@example.com',
  school: 'Sample School',
  city: 'Lisbon',
  note: 'We would love this.',
};

describe('DemoRequestSchema', () => {
  it('accepts a complete request and trims the text fields', () => {
    expect(
      DemoRequestSchema.parse({ ...school, name: '  Sample Person ', school: ' Sample School  ' }),
    ).toEqual(school);
  });

  it('treats a blank country as not given', () => {
    expect(DemoRequestSchema.parse({ ...school, country: '  ' }).country).toBeUndefined();
    expect(DemoRequestSchema.parse({ ...school, country: undefined }).country).toBeUndefined();
  });

  it('offers the international curricula', () => {
    for (const curriculum of ['ib', 'cambridge', 'edexcel', 'american', 'national', 'other']) {
      expect(DemoRequestSchema.safeParse({ ...school, curriculum }).success, curriculum).toBe(true);
    }
  });

  it.each([
    ['name', { name: 'A' }],
    ['name', { name: 'x'.repeat(121) }],
    ['school', { school: '' }],
    ['school', { school: 'x'.repeat(121) }],
    ['email', { email: 'not an email' }],
    ['email', { email: 'name@school' }],
    ['students', { students: '20' }],
    ['curriculum', { curriculum: 'montessori' }],
    ['country', { country: 'x'.repeat(81) }],
  ])('rejects a bad %s with the field as the path', (field, change) => {
    const result = DemoRequestSchema.safeParse({ ...school, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([field]);
  });
});

describe('SchoolIntroRequestSchema', () => {
  it('accepts a parent request, with the city and note optional', () => {
    expect(SchoolIntroRequestSchema.parse(parent)).toEqual(parent);
    expect(SchoolIntroRequestSchema.parse({ ...parent, city: '', note: ' ' })).toEqual({
      name: parent.name,
      email: parent.email,
      school: parent.school,
    });
  });

  it('keeps a note to 1,000 characters', () => {
    expect(SchoolIntroRequestSchema.safeParse({ ...parent, note: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });
});

describe('the first problem to tell the visitor', () => {
  it('is null for a valid request', () => {
    expect(demoRequestProblem(school)).toBeNull();
    expect(schoolIntroProblem(parent)).toBeNull();
  });

  it('asks for the name and school first, then the email (spec 19 errors)', () => {
    expect(demoRequestProblem({ ...school, name: '', email: 'bad' })).toEqual({
      code: 'name_and_school',
      fields: ['name'],
    });
    expect(schoolIntroProblem({ ...parent, name: '', school: '' })).toEqual({
      code: 'name_and_school',
      fields: ['name', 'school'],
    });
    expect(demoRequestProblem({ ...school, email: 'bad' })).toEqual({
      code: 'email',
      fields: ['email'],
    });
  });

  it('reports anything else, such as a choice outside the lists, as its own problem', () => {
    expect(demoRequestProblem({ ...school, students: 'lots' })).toEqual({
      code: 'other',
      fields: ['students'],
    });
    expect(schoolIntroProblem({ ...parent, note: 'x'.repeat(1001) })).toEqual({
      code: 'other',
      fields: ['note'],
    });
  });
});

describe('DemoRequestBody (the API body, spec 06 POST /public/demo-requests)', () => {
  const token = { turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' };

  it('accepts a school request and a parent request, told apart by kind', () => {
    expect(DemoRequestBody.parse({ kind: 'school', ...school, ...token })).toEqual({
      kind: 'school',
      ...school,
      ...token,
    });
    expect(DemoRequestBody.parse({ kind: 'parent', ...parent, ...token })).toEqual({
      kind: 'parent',
      ...parent,
      ...token,
    });
  });

  it('checks each kind with its own form rules', () => {
    // A parent's request has no curriculum; a school's has no note.
    expect(DemoRequestBody.safeParse({ kind: 'school', ...parent, ...token }).success).toBe(false);
    expect(DemoRequestBody.parse({ kind: 'parent', ...school, ...token })).not.toHaveProperty(
      'curriculum',
    );
  });

  it('refuses a missing, empty or oversized Turnstile token', () => {
    for (const turnstileToken of [undefined, '', 'x'.repeat(2049)]) {
      const result = DemoRequestBody.safeParse({ kind: 'school', ...school, turnstileToken });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['turnstileToken']);
    }
    expect(
      DemoRequestBody.safeParse({ kind: 'school', ...school, turnstileToken: 'x'.repeat(2048) })
        .success,
    ).toBe(true);
  });

  it('refuses an unknown or missing kind', () => {
    expect(DemoRequestBody.safeParse({ kind: 'teacher', ...school, ...token }).success).toBe(false);
    expect(DemoRequestBody.safeParse({ ...school, ...token }).success).toBe(false);
  });

  it('refuses a parent note of 1,001 characters at the note', () => {
    const result = DemoRequestBody.safeParse({
      kind: 'parent',
      ...parent,
      ...token,
      note: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['note']);
  });

  it('accepts a filled honeypot, so a bot is not told; the service drops the request', () => {
    expect(
      DemoRequestBody.parse({
        kind: 'school',
        ...school,
        ...token,
        website: 'https://spam.example',
      }).website,
    ).toBe('https://spam.example');
    expect(
      DemoRequestBody.parse({ kind: 'parent', ...parent, ...token, website: '' }).website,
    ).toBe('');
    expect(DemoRequestBody.parse({ kind: 'parent', ...parent, ...token })).not.toHaveProperty(
      'website',
    );
  });

  it('refuses a honeypot over 2,048 characters', () => {
    const at = (website: string) =>
      DemoRequestBody.safeParse({ kind: 'school', ...school, ...token, website });
    expect(at('x'.repeat(2048)).success).toBe(true);
    expect(at('x'.repeat(2049)).error?.issues.map((issue) => issue.path[0])).toEqual(['website']);
  });

  // D32: these values reach the sales email subject and the console Leads list.
  const hidden = [
    ['a line break', 'Sample\nPerson'],
    ['a carriage return and line feed', 'Sample\r\nBcc: x@example.com'],
    ['U+202E right-to-left override', 'Sample \u202ePerson'],
    ['U+2066 left-to-right isolate', 'Sample \u2066Person'],
    ['U+200B zero-width space', 'Sample\u200bPerson'],
    ['U+FEFF byte order mark', 'Sample\ufeffPerson'],
    ['U+0007 bell', 'Sample\u0007Person'],
    ['U+0085 next line', 'Sample\u0085Person'],
  ] as const;

  describe.each([
    ['school', school, ['name', 'email', 'school', 'country']],
    ['parent', parent, ['name', 'email', 'school', 'city']],
  ] as const)('a %s request', (kind, form, fields) => {
    it.each(fields)('refuses hidden characters in %s, a single line, at that field', (field) => {
      for (const [, text] of hidden) {
        const value =
          field === 'email' ? text.replace(' ', '').replace('Person', '@example.com') : text;
        const result = DemoRequestBody.safeParse({ kind, ...form, ...token, [field]: value });
        expect(result.success, JSON.stringify(value)).toBe(false);
        // An email can also fail its shape check; either way, only that field is marked.
        expect([...new Set(result.error?.issues.map((issue) => issue.path[0]))]).toEqual([field]);
      }
    });
  });

  it('keeps line breaks in a parent note and refuses every other hidden character there', () => {
    const withNote = (note: string) =>
      DemoRequestBody.safeParse({ kind: 'parent', ...parent, ...token, note });
    expect(withNote('Line one\nLine two').data).toMatchObject({ note: 'Line one\nLine two' });
    for (const [label, text] of hidden.filter(([label]) => label !== 'a line break')) {
      const result = withNote(text);
      expect(result.success, label).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['note']);
    }
  });

  it('keeps the zero-width joiner and non-joiner, which Sinhala and Tamil spelling needs', () => {
    const name = 'ශ්\u200dරී ලංකා';
    expect(DemoRequestBody.parse({ kind: 'school', ...school, ...token, name }).name).toBe(name);
    const city = 'க\u200cஷ';
    expect(DemoRequestBody.parse({ kind: 'parent', ...parent, ...token, city })).toMatchObject({
      city,
    });
  });

  it('leaves the form schemas as they were: the check belongs to the API body', () => {
    expect(DemoRequestSchema.safeParse({ ...school, name: 'Sample\u200bPerson' }).success).toBe(
      true,
    );
  });
});
