import Link from 'next/link';

import { COMPANY } from '../src/app/(public)/_lib/company';

import type { ArticleContent } from '../src/app/(public)/_lib/article';

/*
 * The About page at /about (D41), laid out as story cards (D45): the three apps on their own
 * cards, the timeline and the founder card. Company facts come from the company module only.
 */

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

export const aboutPage: ArticleContent = {
  path: '/about',
  layout: 'story',
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
      icon: 'tiles',
      tone: 'sky',
      body: <p>Quad brings a school’s work and its families together in three apps:</p>,
      apps: [
        {
          name: 'The staff portal',
          icon: 'screen',
          tint: 'sky',
          text: 'Where a school runs its day: admissions, students, attendance, timetable and cover, exams and reports, pastoral care, fees and communication.',
        },
        {
          name: 'The Quad app for parents',
          icon: 'phone',
          tint: 'pink',
          text: 'On iPhone and Android: a child’s day, moments and good news from school, messages, fees to pay, and relatives the family invites.',
        },
        {
          name: 'The platform console',
          icon: 'tiles',
          tint: 'lime',
          text: 'Where Quad’s own team sets up and supports schools.',
        },
      ],
      aside: {
        icon: 'spark',
        tone: 'orange',
        text: 'In each app, Ask Quad answers questions in plain English from the school’s own records and shows where each answer came from.',
      },
    },
    {
      id: 'who',
      title: 'Who it’s for',
      icon: 'family',
      tint: 'pink',
      isHalf: true,
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
      icon: 'heart',
      tint: 'lime',
      isHalf: true,
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
      icon: 'flag',
      tone: 'lime',
      timeline: [
        {
          when: 'Started',
          title: COMPANY.foundedYear,
          text: `${COMPANY.legalName}, ${COMPANY.registeredAddress}.`,
          state: 'done',
        },
        {
          when: 'Now',
          title: 'In development',
          text: 'Building the staff portal, the parent app and the platform console.',
          state: 'now',
        },
        {
          when: 'Next',
          title: 'Pilots with schools',
          text: 'We’re preparing pilots with schools.',
          state: 'next',
        },
      ],
      body: (
        <p>
          The sample school and families you see on this website are fictional. If you would like
          your school to be one of the first to try Quad, <Link href="/#demo">book a demo</Link>.
        </p>
      ),
    },
    {
      id: 'founder',
      title: 'Who’s behind Quad',
      icon: 'user',
      tone: 'pink',
      isHalf: true,
      person: { name: COMPANY.founder.name, role: COMPANY.founder.role },
      body: <p>{COMPANY.founder.bio}</p>,
    },
    {
      id: 'where',
      title: 'Where we are',
      icon: 'pin',
      tone: 'sky',
      isHalf: true,
      body: (
        <p>
          Quad is based in {COMPANY.country} and built for schools internationally. School data is
          stored in Amazon Web Services’ Mumbai region; the{' '}
          <Link href="/legal/privacy#subprocessors">privacy policy</Link> lists the few services
          that handle data elsewhere.
        </p>
      ),
      facts: [
        COMPANY.legalName,
        COMPANY.registrationNumber,
        COMPANY.registeredAddress,
        COMPANY.foundedYear,
      ],
    },
    {
      id: 'contact',
      title: 'Talk to us',
      icon: 'mail',
      tint: 'orange',
      cta: { href: '/#demo', label: 'Book a 30-minute demo' },
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
