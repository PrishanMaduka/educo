import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DemoForm, type DemoFormLabels } from './DemoForm';

const marker = { slot: '⁣slot⁣', label: '⁣label⁣', value: '⁣value⁣' };

function labels(variant: 'school' | 'parent'): DemoFormLabels {
  const isSchool = variant === 'school';
  return {
    name: 'Your name',
    email: isSchool ? 'Work email' : 'Your email',
    school: isSchool ? 'School' : 'Your child’s school',
    place: isSchool ? 'Country' : 'City',
    students: 'Students',
    curriculum: 'Curriculum',
    note: 'A note to the school (optional)',
    noteInEmail: 'Note',
    notePlaceholder: 'Why you’d like Quad at your school',
    studentsOptions: {
      under_300: 'Under 300',
      '300_1000': '300–1,000',
      '1000_2500': '1,000–2,500',
      over_2500: 'More than 2,500',
    },
    curriculumOptions: {
      ib: 'IB',
      cambridge: 'Cambridge',
      edexcel: 'Edexcel',
      american: 'American',
      national: 'National',
      other: 'Other',
    },
    submit: isSchool ? 'Request a demo' : 'Send to my school',
    errors: {
      name_and_school: isSchool
        ? 'Add your name and your school.'
        : 'Add your name and your child’s school.',
      email: isSchool
        ? 'Enter a work email like name@school.org.'
        : 'Enter an email like name@example.com.',
      other: 'Check the fields marked in pink.',
    },
    privacy: 'We’ll only use this to arrange a walkthrough.',
    sent: 'Your email app should open with your request ready to send.',
    fallback: `If it doesn’t open, email us at ${marker.slot}.`,
    emailMarker: marker.slot,
    again: 'Send another',
    mail: {
      subject: isSchool ? `Demo request: ${marker.slot}` : `Quad for ${marker.slot}`,
      intro: 'Hello Quad',
      line: `${marker.label}: ${marker.value}`,
      marker,
    },
  };
}

let opened: string[] = [];
beforeEach(() => {
  opened = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    opened.push(this.href);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const renderForm = (variant: 'school' | 'parent') =>
  render(
    <DemoForm variant={variant} to="support@quad-edu.com" labels={labels(variant)} cheer={null} />,
  );

describe('DemoForm for schools', () => {
  it('asks for the name and school first, marks them and opens nothing', async () => {
    renderForm('school');
    await userEvent.type(screen.getByLabelText('Work email'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add your name and your school.');
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Add your name and your school.',
    );
    expect(opened).toEqual([]);
  });

  it('then asks for a work email', async () => {
    renderForm('school');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(screen.getByLabelText('School'), 'Sample School');
    await userEvent.type(screen.getByLabelText('Work email'), 'name@school');
    await userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a work email like name@school.org.');
    expect(screen.getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens an email to support with the request, then says what happened', async () => {
    renderForm('school');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(screen.getByLabelText('Work email'), 'name@school.org');
    await userEvent.type(screen.getByLabelText('School'), 'Sample School');
    await userEvent.selectOptions(screen.getByLabelText('Curriculum'), 'cambridge');
    await userEvent.click(screen.getByRole('button', { name: /Request a demo/ }));

    expect(opened).toHaveLength(1);
    const url = new URL(opened[0] ?? '');
    expect(url.pathname).toBe('support@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Demo request: Sample School');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Work email: name@school.org');
    expect(body).toContain('Students: Under 300');
    expect(body).toContain('Curriculum: Cambridge');
    expect(body).not.toContain('Country');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your email app should open with your request ready to send.',
    );
    expect(screen.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      opened[0],
    );

    await userEvent.click(screen.getByRole('button', { name: 'Send another' }));
    expect(screen.getByRole('button', { name: /Request a demo/ })).toBeVisible();
  });
});

describe('DemoForm for parents', () => {
  it('asks for the child’s school in its own words', async () => {
    renderForm('parent');
    await userEvent.click(screen.getByRole('button', { name: /Send to my school/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add your name and your child’s school.');
    expect(screen.queryByLabelText('Curriculum')).toBeNull();
  });

  it('sends the note and city to support, with the school in the subject', async () => {
    renderForm('parent');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Parent');
    await userEvent.type(screen.getByLabelText('Your email'), 'name@example.com');
    await userEvent.type(screen.getByLabelText('Your child’s school'), 'Sample School');
    await userEvent.type(screen.getByLabelText('City'), 'Lisbon');
    await userEvent.type(screen.getByLabelText(/A note to the school/), 'We would love it.');
    await userEvent.click(screen.getByRole('button', { name: /Send to my school/ }));

    const url = new URL(opened[0] ?? '');
    expect(url.pathname).toBe('support@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Quad for Sample School');
    expect(url.searchParams.get('body')).toContain('City: Lisbon');
    expect(url.searchParams.get('body')).toContain('Note: We would love it.');
  });
});
