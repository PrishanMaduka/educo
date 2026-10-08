import { z } from 'zod';

/** School size bands on the demo form (spec 04 `platform_leads.students_band`). */
export const StudentsBand = z.enum(['under_300', '300_1000', '1000_2500', 'over_2500']);
export type StudentsBand = z.infer<typeof StudentsBand>;

/** Curricula offered on the demo form (spec 19 "Demo requests"). */
export const DemoCurriculum = z.enum([
  'ib',
  'cambridge',
  'edexcel',
  'american',
  'national',
  'other',
]);
export type DemoCurriculum = z.infer<typeof DemoCurriculum>;

// A practical shape check (something@domain.tld), the same rule the landing page has always used.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
/** An optional text field: blank counts as not given. */
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const person = {
  name: trimmed(2, 120),
  email: z.string().trim().max(254).regex(EMAIL),
  school: trimmed(2, 120),
};

/**
 * A school's demo request from the landing page ("I run a school"; spec 19 "Demo requests", spec
 * 06 `POST /public/demo-requests`). The page and the API share it. The Turnstile token and
 * honeypot arrive with the endpoint (M1b).
 */
export const DemoRequestSchema = z.object({
  ...person,
  country: optionalText(80),
  students: StudentsBand,
  curriculum: DemoCurriculum,
});
export type DemoRequest = z.infer<typeof DemoRequestSchema>;

/**
 * A parent asking Quad to tell their child's school about it ("I'm a parent", spec 19). Quad
 * writes to the school; it never contacts other families.
 */
export const SchoolIntroRequestSchema = z.object({
  ...person,
  city: optionalText(80),
  note: optionalText(1000),
});
export type SchoolIntroRequest = z.infer<typeof SchoolIntroRequestSchema>;

/** What to tell the visitor: one message at a time, in the order spec 19 gives them. */
export type PublicFormProblemCode = 'name_and_school' | 'email' | 'other';

export interface PublicFormProblem<Field extends string> {
  code: PublicFormProblemCode;
  /** The fields to mark as invalid. */
  fields: Field[];
}

function firstProblem<Field extends string>(
  schema: z.ZodType,
  input: unknown,
  rest: readonly Field[],
): PublicFormProblem<Field | 'name' | 'school' | 'email'> | null {
  const result = schema.safeParse(input);
  if (result.success) return null;
  const bad = new Set(result.error.issues.map((issue) => issue.path[0]));
  const nameAndSchool = (['name', 'school'] as const).filter((field) => bad.has(field));
  if (nameAndSchool.length > 0) return { code: 'name_and_school', fields: nameAndSchool };
  if (bad.has('email')) return { code: 'email', fields: ['email'] };
  return { code: 'other', fields: rest.filter((field) => bad.has(field)) };
}

/** The first problem with a school's demo form, or null when it is ready to send. */
export function demoRequestProblem(input: unknown) {
  return firstProblem(DemoRequestSchema, input, ['country', 'students', 'curriculum'] as const);
}

/** The first problem with a parent's form, or null when it is ready to send. */
export function schoolIntroProblem(input: unknown) {
  return firstProblem(SchoolIntroRequestSchema, input, ['city', 'note'] as const);
}
