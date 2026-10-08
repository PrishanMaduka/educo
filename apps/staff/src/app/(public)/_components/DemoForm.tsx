'use client';

import {
  DEFAULT_DEMO_COUNTRY,
  DemoCurriculum,
  DemoRequestSchema,
  demoRequestProblem,
  StudentsBand,
  type DemoRequest,
  type DemoRequestProblemCode,
} from '@quad/contracts/public';
import { cn } from '@quad/ui';
import { useId, useState, type FormEvent } from 'react';

import { buildDemoMailto, type DemoMailLabels } from '../_lib/demo-mailto';

import { button, focusRing } from './styles';

export interface DemoFormLabels {
  fields: Record<keyof DemoRequest, string>;
  students: Record<StudentsBand, string>;
  curricula: Record<DemoCurriculum, string>;
  submit: string;
  errors: Record<DemoRequestProblemCode, string>;
  note: string;
  sent: string;
  /** "If it doesn't open, email us at {email}", with `emailMarker` where the address goes. */
  fallback: string;
  emailMarker: string;
  mail: DemoMailLabels;
}

/** Opens the visitor's email app. A link click, so browsers treat it as the visitor's own action. */
function openEmail(href: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.click();
}

const control = cn(
  'h-[46px] w-full rounded-input border-[1.5px] border-solid border-line bg-canvas px-3.5 text-[15px] font-semibold text-ink',
  'focus:border-coral-ink aria-invalid:border-coral-ink',
  focusRing,
);
const fieldLabel = 'flex flex-col gap-1.5 text-[13px] font-extrabold text-ink-2';

type Field = keyof DemoRequest;

/**
 * Book a 30-minute walkthrough (spec 19 §11). The fields and checks are the shared `DemoRequest`
 * schema. Until the demo endpoint exists (M1b) a valid request opens the visitor's email app,
 * addressed to `to`, with the request filled in (decision log, 2026-10-08).
 */
export function DemoForm({ to, labels }: { to: string; labels: DemoFormLabels }) {
  const errorId = useId();
  const [problem, setProblem] = useState<{ message: string; fields: Field[] } | null>(null);
  const [sentHref, setSentHref] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const found = demoRequestProblem(values);
    if (found) {
      setProblem({ message: labels.errors[found.code], fields: found.fields });
      setSentHref(null);
      return;
    }
    const href = buildDemoMailto(to, DemoRequestSchema.parse(values), labels.mail);
    setProblem(null);
    setSentHref(href);
    openEmail(href);
  };

  const invalid = (field: Field) => problem?.fields.includes(field) ?? false;
  const textField = (
    field: Field,
    extra: { type?: string; autoComplete: string },
    full = false,
  ) => (
    <label className={cn(fieldLabel, full && 'col-span-full')}>
      {labels.fields[field]}
      <input
        name={field}
        type={extra.type ?? 'text'}
        autoComplete={extra.autoComplete}
        required
        aria-invalid={invalid(field) || undefined}
        aria-describedby={errorId}
        defaultValue={field === 'country' ? DEFAULT_DEMO_COUNTRY : undefined}
        className={control}
      />
    </label>
  );
  const [beforeEmail, afterEmail] = labels.fallback.split(labels.emailMarker);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="grid grid-cols-2 content-start gap-3.5 max-[820px]:grid-cols-1"
    >
      {textField('name', { autoComplete: 'name' })}
      {textField('email', { type: 'email', autoComplete: 'email' })}
      {textField('school', { autoComplete: 'organization' })}
      {textField('country', { autoComplete: 'country-name' })}
      <label className={fieldLabel}>
        {labels.fields.students}
        <select name="students" defaultValue="300_1000" className={control}>
          {StudentsBand.options.map((band) => (
            <option key={band} value={band}>
              {labels.students[band]}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        {labels.fields.curriculum}
        <select name="curriculum" defaultValue="cambridge" className={control}>
          {DemoCurriculum.options.map((curriculum) => (
            <option key={curriculum} value={curriculum}>
              {labels.curricula[curriculum]}
            </option>
          ))}
        </select>
      </label>
      <p
        id={errorId}
        role="alert"
        className="col-span-full m-0 min-h-[1em] text-[13.5px] font-bold text-coral-ink"
      >
        {problem?.message}
      </p>
      <button type="submit" className={cn(button({ size: 'lg' }), 'col-span-full w-full')}>
        {labels.submit}
      </button>
      {sentHref ? (
        <p
          role="status"
          className="col-span-full m-0 rounded-[14px] bg-teal-soft px-4 py-3.5 font-bold"
        >
          {labels.sent}{' '}
          <span className="font-semibold text-ink-2">
            {beforeEmail}
            <a href={sentHref} className={cn('font-extrabold text-coral-ink underline', focusRing)}>
              {to}
            </a>
            {afterEmail}
          </span>
        </p>
      ) : null}
      <p className="col-span-full m-0 text-[12.5px] text-ink-2">{labels.note}</p>
    </form>
  );
}
