import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DemoForm, type DemoFormLabels } from './DemoForm';

const fields = {
  name: 'Your name',
  email: 'Work email',
  school: 'School',
  country: 'Country',
  students: 'Students',
  curriculum: 'Curriculum',
};
const students = {
  under_300: 'Under 300',
  '300_1000': '300–1,000',
  '1000_2500': '1,000–2,500',
  over_2500: 'More than 2,500',
};
const curricula = {
  cambridge: 'Cambridge',
  edexcel: 'Edexcel',
  ib: 'IB',
  sri_lankan_national: 'Sri Lankan national',
  other: 'Other',
};
const marker = { slot: '⁣slot⁣', label: '⁣label⁣', value: '⁣value⁣' };

const labels: DemoFormLabels = {
  fields,
  students,
  curricula,
  submit: 'Request a demo',
  errors: {
    name_and_school: 'Add your name and your school.',
    work_email: 'Enter a work email like name@school.lk.',
    choice: 'Choose an option from each list.',
  },
  note: 'We’ll only use this to arrange your demo.',
  sent: 'Your email app should open with your request ready to send.',
  fallback: `If it doesn’t open, email us at ${marker.slot}.`,
  emailMarker: marker.slot,
  mail: {
    subject: `Demo request: ${marker.slot}`,
    intro: 'Hello Quad',
    line: `${marker.label}: ${marker.value}`,
    fields,
    students,
    curricula,
    marker,
  },
};

let opened: string[] = [];
beforeEach(() => {
  opened = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    opened.push(this.href);
  });
});
afterEach(() => vi.restoreAllMocks());

describe('DemoForm', () => {
  it('asks for the name and school first, marks them and opens nothing', async () => {
    render(<DemoForm to="support@quad-edu.com" labels={labels} />);
    await userEvent.type(screen.getByLabelText('Work email'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Request a demo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add your name and your school.');
    expect(screen.getByLabelText('Your name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'Add your name and your school.',
    );
    expect(opened).toEqual([]);
  });

  it('then asks for a work email', async () => {
    render(<DemoForm to="support@quad-edu.com" labels={labels} />);
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(screen.getByLabelText('School'), 'Sample School');
    await userEvent.type(screen.getByLabelText('Work email'), 'name@school');
    await userEvent.click(screen.getByRole('button', { name: 'Request a demo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a work email like name@school.lk.');
    expect(screen.getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens the email app with the request and says what happened', async () => {
    render(<DemoForm to="support@quad-edu.com" labels={labels} />);
    await userEvent.type(screen.getByLabelText('Your name'), 'Sample Person');
    await userEvent.type(screen.getByLabelText('Work email'), 'name@school.lk');
    await userEvent.type(screen.getByLabelText('School'), 'Sample School');
    await userEvent.selectOptions(screen.getByLabelText('Curriculum'), 'ib');
    await userEvent.click(screen.getByRole('button', { name: 'Request a demo' }));

    expect(opened).toHaveLength(1);
    const url = new URL(opened[0] ?? '');
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('support@quad-edu.com');
    expect(url.searchParams.get('subject')).toBe('Demo request: Sample School');
    expect(url.searchParams.get('body')).toContain('Curriculum: IB');
    expect(url.searchParams.get('body')).toContain('Students: 300–1,000');
    expect(url.searchParams.get('body')).toContain('Country: Sri Lanka');
    expect(screen.getByRole('status')).toHaveTextContent(labels.sent);
    expect(screen.getByRole('link', { name: 'support@quad-edu.com' })).toHaveAttribute(
      'href',
      opened[0],
    );
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });
});
