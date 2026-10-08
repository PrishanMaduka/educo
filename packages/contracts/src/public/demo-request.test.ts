import { describe, expect, it } from 'vitest';

import {
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
