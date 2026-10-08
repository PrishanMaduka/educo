import { describe, expect, it } from 'vitest';

import { DemoRequestSchema, demoRequestProblem } from './demo-request';

const valid = {
  name: 'Sample Person',
  email: 'name@school.lk',
  school: 'Sample School',
  students: '300_1000',
  curriculum: 'cambridge',
  country: 'Sri Lanka',
};

describe('DemoRequestSchema', () => {
  it('accepts a complete request and trims the text fields', () => {
    expect(
      DemoRequestSchema.parse({ ...valid, name: '  Sample Person ', school: ' Sample School  ' }),
    ).toEqual(valid);
  });

  it('defaults the country to Sri Lanka', () => {
    expect(DemoRequestSchema.parse({ ...valid, country: undefined }).country).toBe('Sri Lanka');
    expect(DemoRequestSchema.parse({ ...valid, country: '  ' }).country).toBe('Sri Lanka');
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
    const result = DemoRequestSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([field]);
  });
});

describe('demoRequestProblem', () => {
  it('is null for a valid request', () => {
    expect(demoRequestProblem(valid)).toBeNull();
  });

  it('asks for the name and school first, then the email (spec 19 errors)', () => {
    expect(demoRequestProblem({ ...valid, name: '', email: 'bad' })).toEqual({
      code: 'name_and_school',
      fields: ['name'],
    });
    expect(demoRequestProblem({ ...valid, name: '', school: '' })).toEqual({
      code: 'name_and_school',
      fields: ['name', 'school'],
    });
    expect(demoRequestProblem({ ...valid, email: 'bad' })).toEqual({
      code: 'work_email',
      fields: ['email'],
    });
  });

  it('reports a choice outside the lists as its own problem', () => {
    expect(demoRequestProblem({ ...valid, students: 'lots' })).toEqual({
      code: 'choice',
      fields: ['students'],
    });
  });
});
