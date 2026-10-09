/*
 * NEEDS LEGAL REVIEW BEFORE LAUNCH. A plain-English first draft of Quad's terms of service (spec 19
 * "Legal pages", D41), written before launch so schools and reviewers can see how Quad intends to
 * work. The company facts, governing law and liability cap are placeholders in
 * src/app/(public)/_lib/company.ts until the owner and a lawyer confirm them.
 */
import Link from 'next/link';

import { COMPANY } from '../../src/app/(public)/_lib/company';

import type { ArticleContent } from '../../src/app/(public)/_lib/article';

const mail = (address: string) => <a href={`mailto:${address}`}>{address}</a>;

export const termsPage: ArticleContent = {
  path: '/legal/terms',
  eyebrow: 'Legal',
  title: 'Terms of service',
  metaTitle: 'Terms of service – Quad',
  summary:
    'These terms are the agreement between Quad and each school that uses it; parents, relatives and staff use Quad under their school’s agreement.',
  description:
    'Quad’s terms of service: the agreement with each school, acceptable use, accounts, fees, data ownership, availability, changes and governing law.',
  updated: { date: '2026-10-09', version: '0.1' },
  layout: 'legal',
  inShort: [
    'The agreement is between Quad and the school. Staff, parents and relatives use Quad under it.',
    'Everything the school puts into Quad belongs to the school. We never sell it.',
    'When parents pay school fees in the app, the money goes to the school. Quad does not hold it.',
    'Ask Quad can be wrong, so check its answers and drafts before you rely on them.',
    'We email school admins at least 30 days before a material change to these terms.',
    'Quad is in development. These terms describe how we intend to work with schools from the first pilot.',
  ],
  sections: [
    {
      id: 'agreement',
      title: 'Who the agreement is with',
      icon: 'doc',
      body: (
        <>
          <p>
            These terms are an agreement between {COMPANY.legalName} (“Quad”, “we”) and the school
            or school group that signs up to use Quad (“the school”). The school’s order form or
            plan sits alongside them; if the two disagree, the order form wins.
          </p>
          <p>
            Quad is in development. These terms describe how we intend to work with schools from the
            first pilot.
          </p>
        </>
      ),
    },
    {
      id: 'people',
      title: 'Staff, parents and relatives',
      icon: 'family',
      body: (
        <>
          <p>
            The school invites its staff and the parents and guardians of its students. They use
            Quad under the school’s agreement, and the school is responsible for who it invites and
            what role each person has.
          </p>
          <p>
            Parents can invite relatives into their child’s circle. Relatives see moments only, and
            a parent or the school can remove them at any time.
          </p>
        </>
      ),
    },
    {
      id: 'accounts',
      title: 'Accounts and security',
      icon: 'key',
      body: (
        <ul>
          <li>Each account is for one person. Do not share passwords or sign-in codes.</li>
          <li>Use two-step sign-in wherever the school or Quad requires it.</li>
          <li>
            Tell the school, or us at {mail(COMPANY.contact.security)}, straight away if you think
            someone else has used your account.
          </li>
          <li>
            The school manages its users and their roles. We may suspend an account to protect a
            school, its families or Quad, and we tell the school when we do.
          </li>
        </ul>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      icon: 'rule',
      body: (
        <>
          <p>When using Quad, do not:</p>
          <ul>
            <li>
              break the law, or upload anything unlawful, harmful or that you have no right to
              share;
            </li>
            <li>try to see data you have not been given access to, including another school’s;</li>
            <li>
              probe, scan or test Quad’s security without our written permission (report issues to{' '}
              {mail(COMPANY.contact.security)} instead);
            </li>
            <li>overload, disrupt or reverse engineer Quad, except where the law allows it;</li>
            <li>use Quad to send spam or messages that have nothing to do with school life.</li>
          </ul>
          <p>
            Ask Quad drafts letters and answers questions from the school’s records. It can be
            wrong, so check its answers and drafts before you rely on them or send them.
          </p>
        </>
      ),
    },
    {
      id: 'fees',
      title: 'Fees',
      icon: 'card',
      body: (
        <>
          <p>
            The school pays the fees set out in its order form or plan, on the terms stated there,
            plus any taxes that apply.
          </p>
          <p>
            When parents pay school fees in the app, the money goes to the school through the
            school’s own payment provider. Quad does not hold it.
          </p>
        </>
      ),
    },
    {
      id: 'data',
      title: 'The school owns its data',
      icon: 'server',
      body: (
        <>
          <p>
            Everything the school and its people put into Quad belongs to the school. We use it only
            to run Quad for the school, on its instructions, as the{' '}
            <Link href="/legal/privacy">privacy policy</Link> describes. We never sell it.
          </p>
          <p>
            The school can export its data at any time. When the agreement ends, we return the data
            on request and then delete it; backups age out within 35 days.
          </p>
        </>
      ),
    },
    {
      id: 'availability',
      title: 'Availability and support',
      icon: 'power',
      body: (
        <p>
          We work to keep Quad available and to tell schools about planned maintenance in advance.
          We do not publish service levels yet; any that apply to a school will be in its order
          form.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to Quad and to these terms',
      icon: 'swap',
      body: (
        <p>
          Quad will keep improving. We email school admins at least 30 days before a material change
          to these terms or a change that removes something the school relies on. The date and
          version at the top show when these terms last changed.
        </p>
      ),
    },
    {
      id: 'ending',
      title: 'Ending the agreement',
      icon: 'door',
      body: (
        <p>
          The agreement lasts for the term in the school’s order form. Either side may end it as the
          order form allows, or straight away if the other side seriously breaks these terms and
          does not put it right within 30 days of being told.
        </p>
      ),
    },
    {
      id: 'liability',
      title: 'Liability',
      icon: 'shield',
      body: (
        <>
          <p>
            Each side’s total liability under this agreement is limited to: {COMPANY.liabilityCap}.
          </p>
          <p>Nothing in these terms limits liability that the law does not allow to be limited.</p>
        </>
      ),
    },
    {
      id: 'law',
      title: 'Governing law',
      icon: 'scale',
      body: (
        <p>
          These terms are governed by: {COMPANY.governingLaw}. Disputes go to: {COMPANY.courts}.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: 'chat',
      body: (
        <p>
          {COMPANY.legalName}, {COMPANY.registeredAddress} ({COMPANY.registrationNumber}). Email{' '}
          {mail(COMPANY.contact.support)}.
        </p>
      ),
    },
  ],
};
