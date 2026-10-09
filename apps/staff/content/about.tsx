import Link from 'next/link';

import { COMPANY } from '../src/app/(public)/_lib/company';

import type { ArticleContent } from '../src/app/(public)/_lib/article';

/* The About page at /about (D41). Company facts come from the company module only. */

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

export const aboutPage: ArticleContent = {
  path: '/about',
  eyebrow: 'About Quad',
  title: 'A school platform built around the child.',
  metaTitle: 'About Quad',
  summary: `Quad is a school platform, in development in ${COMPANY.country}, that helps everyone who looks after a child — at school and at home — see the same picture.`,
  description:
    'Quad is a school platform built around the child: a staff portal, a parent app and a platform console. In development; preparing pilots with schools.',
  sections: [
    {
      id: 'what',
      title: 'What Quad is',
      body: (
        <>
          <p>Quad brings a school’s work and its families together in three apps:</p>
          <ul>
            <li>
              <strong>The staff portal</strong>, where a school runs its day: admissions, students,
              attendance, timetable and cover, exams and reports, pastoral care, fees and
              communication.
            </li>
            <li>
              <strong>The Quad app for parents</strong>, on iPhone and Android: a child’s day,
              moments and good news from school, messages, fees to pay, and relatives the family
              invites.
            </li>
            <li>
              <strong>The platform console</strong>, where Quad’s own team sets up and supports
              schools.
            </li>
          </ul>
          <p>
            In each app, Ask Quad answers questions in plain English from the school’s own records
            and shows where each answer came from.
          </p>
        </>
      ),
    },
    {
      id: 'who',
      title: 'Who it’s for',
      body: (
        <p>
          Schools of any size and curriculum, and the people around each child: class teachers,
          coaches, school nurses, leaders and office staff, and the family at home, including
          grandparents and relatives wherever they live. Year groups follow each school’s own
          curriculum.
        </p>
      ),
    },
    {
      id: 'why',
      title: 'Why we’re building it',
      body: (
        <>
          <p>
            Most school systems are built around records. The people who care about a child each see
            a piece: the teacher sees marks, the nurse sees a visit, the family hears very little
            until something goes wrong.
          </p>
          <p>
            Quad is built around the child instead. It is designed to notice a child who is starting
            to drift while there is time to help, to bring good news home as it happens, and to keep
            teachers’ evenings calm with quiet hours.
          </p>
        </>
      ),
    },
    {
      id: 'stage',
      title: 'Where we are now',
      body: (
        <>
          <p>
            <strong>In development. We’re preparing pilots with schools.</strong>
          </p>
          <p>
            The sample school and families you see on this website are fictional. If you would like
            your school to be one of the first to try Quad, <Link href="/#demo">book a demo</Link>.
          </p>
        </>
      ),
    },
    {
      id: 'founder',
      title: 'Who’s behind Quad',
      body: (
        <>
          <p>
            <strong>{COMPANY.founder.name}</strong>, {COMPANY.founder.role}
          </p>
          <p>{COMPANY.founder.bio}</p>
        </>
      ),
    },
    {
      id: 'where',
      title: 'Where we are',
      body: (
        <>
          <p>
            Quad is based in {COMPANY.country} and built for schools internationally. School data is
            stored in Amazon Web Services’ Mumbai region; the{' '}
            <Link href="/legal/subprocessors">sub-processors page</Link> lists the few services that
            handle data elsewhere.
          </p>
          <ul>
            <li>{COMPANY.legalName}</li>
            <li>{COMPANY.registrationNumber}</li>
            <li>{COMPANY.registeredAddress}</li>
            <li>{COMPANY.foundedYear}</li>
          </ul>
        </>
      ),
    },
    {
      id: 'contact',
      title: 'Talk to us',
      body: (
        <>
          <p>
            Email {mail(COMPANY.contact.support)} with any question, or{' '}
            <Link href="/#demo">book a 30-minute demo</Link>.
          </p>
          <p>
            Privacy questions go to {mail(COMPANY.contact.privacy)}, and security reports to{' '}
            {mail(COMPANY.contact.security)}.
          </p>
        </>
      ),
    },
  ],
};
