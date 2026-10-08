import { describe, expect, it } from 'vitest';

import { buildRequestMailto, fillSlot } from './demo-mailto';

const marker = { slot: '⁣slot⁣', label: '⁣label⁣', value: '⁣value⁣' };
const text = {
  subject: `Demo request: ${marker.slot}`,
  intro: 'Hello Quad, I’d like a walkthrough.',
  line: `${marker.label}: ${marker.value}`,
  marker,
};

describe('buildRequestMailto', () => {
  const href = buildRequestMailto(
    'support@quad-edu.com',
    'Hill & Lake School',
    [
      ['Your name', 'Sample Person'],
      ['Work email', 'name@school.org'],
      ['School', 'Hill & Lake School'],
      ['Country', undefined],
      ['Curriculum', 'IB'],
    ],
    text,
  );

  it('writes to support@quad-edu.com with the school in the subject', () => {
    const url = new URL(href);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('support@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Demo request: Hill & Lake School');
  });

  it('puts each field with a value on its own line, in order', () => {
    expect(new URL(href).searchParams.get('body')).toBe(
      [
        'Hello Quad, I’d like a walkthrough.',
        '',
        'Your name: Sample Person',
        'Work email: name@school.org',
        'School: Hill & Lake School',
        'Curriculum: IB',
      ].join('\r\n'),
    );
  });

  it('percent-encodes spaces, line breaks and ampersands (no + for spaces)', () => {
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
