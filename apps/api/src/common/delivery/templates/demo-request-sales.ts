import { DemoCurriculum, DemoRequestSchema, StudentsBand } from '@quad/contracts';
import { z } from 'zod';

import { defineEmailTemplate } from './email-template';
import { Link, SendableAddress, TypedLine, TypedNote } from './params';
import { formatMessage } from './render';

import type { Paragraph } from './email-template';
import type { MessageKey } from './render';

const STUDENTS = {
  under_300: 'public.demo.students.under_300',
  '300_1000': 'public.demo.students.300_1000',
  '1000_2500': 'public.demo.students.1000_2500',
  over_2500: 'public.demo.students.over_2500',
} as const satisfies Record<StudentsBand, MessageKey>;

const CURRICULA = {
  ib: 'public.demo.curriculum.ib',
  cambridge: 'public.demo.curriculum.cambridge',
  edexcel: 'public.demo.curriculum.edexcel',
  american: 'public.demo.curriculum.american',
  national: 'public.demo.curriculum.national',
  other: 'public.demo.curriculum.other',
} as const satisfies Record<DemoCurriculum, MessageKey>;

const SalesParams = z
  .object({
    kind: z.enum(['school', 'parent']),
    name: TypedLine,
    // The contract's own check: no whitespace, so never a line break in the Reply-To header.
    email: DemoRequestSchema.shape.email,
    school: TypedLine,
    country: TypedLine.optional(),
    students: StudentsBand.optional(),
    curriculum: DemoCurriculum.optional(),
    city: TypedLine.optional(),
    note: TypedNote.optional(),
    /** `{CONSOLE_URL}/leads/{leadId}`; the Leads view arrives in M2 (OQ-T5). */
    link: Link,
  })
  .strict();
type SalesParams = z.output<typeof SalesParams>;

/** One "Label: value" line per filled field, in the form's order. */
function fieldLines(params: SalesParams): readonly MessageKey[] {
  const optional: readonly [keyof SalesParams, MessageKey][] = [
    ['country', 'email.demoRequestSales.field.country'],
    ['students', 'email.demoRequestSales.field.students'],
    ['curriculum', 'email.demoRequestSales.field.curriculum'],
    ['city', 'email.demoRequestSales.field.city'],
    ['note', 'email.demoRequestSales.field.note'],
  ];
  return [
    'email.demoRequestSales.field.name',
    'email.demoRequestSales.field.email',
    'email.demoRequestSales.field.school',
    ...optional.filter(([field]) => params[field] !== undefined).map(([, key]) => key),
  ];
}

/**
 * The lead notification for Quad's team (`SALES_INBOX`, D57): what the visitor typed, as plain
 * text (escaped in the HTML), with Reply-To the visitor when their address is sendable. Nothing
 * is ever sent to the school.
 */
export const demoRequestSalesEmail = defineEmailTemplate({
  sender: 'account',
  params: SalesParams,
  values: (params) => ({
    name: params.name,
    email: params.email,
    schoolName: params.school,
    ...(params.country === undefined ? {} : { country: params.country }),
    ...(params.students === undefined
      ? {}
      : { students: formatMessage(STUDENTS[params.students]) }),
    ...(params.curriculum === undefined
      ? {}
      : { curriculum: formatMessage(CURRICULA[params.curriculum]) }),
    ...(params.city === undefined ? {} : { city: params.city }),
    ...(params.note === undefined ? {} : { note: params.note }),
  }),
  subject: ({ kind }) =>
    kind === 'school'
      ? 'email.demoRequestSales.subject.school'
      : 'email.demoRequestSales.subject.parent',
  body: (params): readonly Paragraph[] => [
    params.kind === 'school'
      ? 'email.demoRequestSales.intro.school'
      : 'email.demoRequestSales.intro.parent',
    fieldLines(params),
    'email.demoRequestSales.reply',
  ],
  action: { label: 'email.demoRequestSales.action', link: ({ link }) => link, to: 'console' },
  after: ['email.demoRequestSales.consoleSoon'],
  // Only an address a header can carry safely; an odd form-valid one is still in the body.
  replyTo: ({ email }) => (SendableAddress.safeParse(email).success ? email : undefined),
  footer: 'email.demoRequestSales.footer',
});
