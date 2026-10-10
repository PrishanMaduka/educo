import {
  DemoRequestSchema,
  demoRequestProblem,
  demoRequestProblemAt,
  SchoolIntroRequestSchema,
  schoolIntroProblem,
  schoolIntroProblemAt,
  type DemoRequest,
  type DemoRequestBody,
  type PublicFormProblem,
  type SchoolIntroRequest,
} from '@quad/contracts/public';

/*
 * The demo forms' checks and request body (spec 19 "Demo requests"). Its own chunk, with Zod,
 * fetched when the demo section nears the screen or the form is first focused, so neither weighs
 * on the landing page's first load (D57).
 */

export type DemoVariant = 'school' | 'parent';

export type DemoField =
  'name' | 'email' | 'school' | 'country' | 'city' | 'students' | 'curriculum' | 'note';

/** A form's request, told apart by `kind` as the API body is. */
export type DemoFormRequest =
  ({ kind: 'school' } & DemoRequest) | ({ kind: 'parent' } & SchoolIntroRequest);

export type CheckedDemoForm =
  { ok: false; problem: PublicFormProblem<DemoField> } | { ok: true; request: DemoFormRequest };

/**
 * The form's first problem, or its request. The schemas' parse keeps only the form's fields, so
 * anything else in the form's values (Turnstile's hidden `cf-turnstile-response`, the honeypot)
 * never reaches the API's strict body.
 */
export function checkDemoForm(
  variant: DemoVariant,
  values: Readonly<Record<string, unknown>>,
): CheckedDemoForm {
  if (variant === 'school') {
    const problem = demoRequestProblem(values);
    if (problem) return { ok: false, problem };
    return { ok: true, request: { kind: 'school', ...DemoRequestSchema.parse(values) } };
  }
  const problem = schoolIntroProblem(values);
  if (problem) return { ok: false, problem };
  return { ok: true, request: { kind: 'parent', ...SchoolIntroRequestSchema.parse(values) } };
}

/** `POST /public/demo-requests`'s body: the request, the Turnstile token and the honeypot as is. */
export function demoRequestBody(
  request: DemoFormRequest,
  antiSpam: { turnstileToken: string; website: string },
): DemoRequestBody {
  return { ...request, ...antiSpam };
}

/** What to tell the visitor about the paths a 400 `validation` refused. */
export function problemAt(
  variant: DemoVariant,
  paths: readonly string[],
): PublicFormProblem<DemoField> {
  return variant === 'school' ? demoRequestProblemAt(paths) : schoolIntroProblemAt(paths);
}
