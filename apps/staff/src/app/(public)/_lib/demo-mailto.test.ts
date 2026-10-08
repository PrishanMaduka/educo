import { describe, expect, it } from 'vitest';

import { buildDemoMailto, fillSlot } from './demo-mailto';

const labels = {
  subject: 'Demo request: ⁣slot⁣',
  intro: 'Hello Quad, I’d like a walkthrough.',
  line: '⁣label⁣: ⁣value⁣',
  fields: {
    name: 'Your name',
    email: 'Work email',
    school: 'School',
    country: 'Country',
    students: 'Students',
    curriculum: 'Curriculum',
  },
  students: {
    under_300: 'Under 300',
    '300_1000': '300–1,000',
    '1000_2500': '1,000–2,500',
    over_2500: 'More than 2,500',
  },
  curricula: {
    cambridge: 'Cambridge',
    edexcel: 'Edexcel',
    ib: 'IB',
    sri_lankan_national: 'Sri Lankan national',
    other: 'Other',
  },
  marker: { slot: '⁣slot⁣', label: '⁣label⁣', value: '⁣value⁣' },
} as const;

const request = {
  name: 'Sample Person',
  email: 'name@school.lk',
  school: 'Hill & Lake School',
  country: 'Sri Lanka',
  students: '300_1000',
  curriculum: 'sri_lankan_national',
} as const;

describe('buildDemoMailto', () => {
  it('writes to hello@quad-edu.com with the school in the subject', () => {
    const href = buildDemoMailto('hello@quad-edu.com', request, labels);
    const url = new URL(href);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('hello@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Demo request: Hill & Lake School');
  });

  it('puts every field in the body, one per line, with the list labels', () => {
    const url = new URL(buildDemoMailto('hello@quad-edu.com', request, labels));
    expect(url.searchParams.get('body')).toBe(
      [
        'Hello Quad, I’d like a walkthrough.',
        '',
        'Your name: Sample Person',
        'Work email: name@school.lk',
        'School: Hill & Lake School',
        'Country: Sri Lanka',
        'Students: 300–1,000',
        'Curriculum: Sri Lankan national',
      ].join('\r\n'),
    );
  });

  it('percent-encodes spaces, line breaks and ampersands (no + for spaces)', () => {
    const href = buildDemoMailto('hello@quad-edu.com', request, labels);
    expect(href).toContain('subject=Demo%20request%3A%20Hill%20%26%20Lake%20School');
    expect(href).toContain('%0D%0A');
    expect(href).not.toContain('+');
    expect(href.split('?')).toHaveLength(2);
  });
});

describe('fillSlot', () => {
  it('replaces every marker with the value', () => {
    expect(fillSlot('a ⁣slot⁣ b ⁣slot⁣', '⁣slot⁣', 'x')).toBe('a x b x');
  });
});
