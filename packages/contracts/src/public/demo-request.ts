import { z } from 'zod';

/** School size bands on the demo form (spec 04 `platform_leads.students_band`). */
export const StudentsBand = z.enum(['under_300', '300_1000', '1000_2500', 'over_2500']);
export type StudentsBand = z.infer<typeof StudentsBand>;

/** Curricula offered on the demo form (spec 19 "Demo requests"). */
export const DemoCurriculum = z.enum([
  'cambridge',
  'edexcel',
  'ib',
  'sri_lankan_national',
  'other',
]);
export type DemoCurriculum = z.infer<typeof DemoCurriculum>;

export const DEFAULT_DEMO_COUNTRY = 'Sri Lanka';

// A practical shape check (something@domain.tld), the same rule the landing page has always used.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/**
 * A demo request from the landing page (spec 19 "Demo requests", spec 06 `POST /public/demo-requests`).
 * The page and the API share it. The Turnstile token and honeypot arrive with the endpoint (M1b).
 */
export const DemoRequestSchema = z.object({
  name: trimmed(2, 120),
  email: z.string().trim().max(254).regex(EMAIL),
  school: trimmed(2, 120),
  students: StudentsBand,
  curriculum: DemoCurriculum,
  country: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    trimmed(2, 80).default(DEFAULT_DEMO_COUNTRY),
  ),
});
export type DemoRequest = z.infer<typeof DemoRequestSchema>;

/** What to tell the visitor: one message at a time, in the order spec 19 gives them. */
export type DemoRequestProblemCode = 'name_and_school' | 'work_email' | 'choice';

export interface DemoRequestProblem {
  code: DemoRequestProblemCode;
  /** The fields to mark as invalid. */
  fields: (keyof DemoRequest)[];
}

/** The first problem with a demo form, or null when it is ready to send. */
export function demoRequestProblem(input: unknown): DemoRequestProblem | null {
  const result = DemoRequestSchema.safeParse(input);
  if (result.success) return null;
  const bad = new Set(result.error.issues.map((issue) => issue.path[0]));
  const pick = (fields: (keyof DemoRequest)[]) => fields.filter((field) => bad.has(field));

  const nameAndSchool = pick(['name', 'school']);
  if (nameAndSchool.length > 0) return { code: 'name_and_school', fields: nameAndSchool };
  if (bad.has('email')) return { code: 'work_email', fields: ['email'] };
  return { code: 'choice', fields: pick(['students', 'curriculum', 'country']) };
}
