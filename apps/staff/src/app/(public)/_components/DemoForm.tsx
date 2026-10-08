'use client';

import {
  DemoCurriculum,
  DemoRequestSchema,
  demoRequestProblem,
  SchoolIntroRequestSchema,
  schoolIntroProblem,
  StudentsBand,
  type PublicFormProblemCode,
} from '@quad/contracts/public';
import { cn } from '@quad/ui';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { buildRequestMailto, type MailText } from '../_lib/demo-mailto';

import { button, focusRing } from './styles';

export interface DemoFormLabels {
  name: string;
  email: string;
  school: string;
  /** Country (schools) or City (parents). */
  place: string;
  students: string;
  curriculum: string;
  note: string;
  /** The note's label in the email ("Note"). */
  noteInEmail: string;
  notePlaceholder: string;
  studentsOptions: Record<StudentsBand, string>;
  curriculumOptions: Record<DemoCurriculum, string>;
  submit: string;
  errors: Record<PublicFormProblemCode, string>;
  privacy: string;
  sent: string;
  /** "If it doesn't open, email us at {email}", with `emailMarker` where the address goes. */
  fallback: string;
  emailMarker: string;
  again: string;
  mail: MailText;
}

/** Opens the visitor's email app. A link click, so browsers treat it as the visitor's own action. */
function openEmail(href: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.click();
}

const control = cn(
  'w-full rounded-xl border-2 border-solid border-site-navy-line bg-site-navy-2 px-3.5 py-3 text-[15px] text-site-on-navy',
  'focus:border-site-accent aria-invalid:border-site-pink',
  focusRing,
);
const fieldLabel = 'flex flex-col gap-1.5 text-[13px] font-semibold text-site-on-navy-2';

type Field = 'name' | 'email' | 'school' | 'country' | 'city' | 'students' | 'curriculum' | 'note';

/**
 * The demo panel's form (spec 19): a demo request for schools, or "tell my school" for parents.
 * The checks are the shared contracts. Until the demo endpoint exists (M1b) a valid request opens
 * the visitor's email app, addressed to `to`, with the fields filled in (decision log D30).
 */
export function DemoForm({
  variant,
  to,
  labels,
  cheer,
}: {
  variant: 'school' | 'parent';
  to: string;
  labels: DemoFormLabels;
  /** Maya's face, cheering when the request is ready. */
  cheer: ReactNode;
}) {
  const errorId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const [problem, setProblem] = useState<{ message: string; fields: Field[] } | null>(null);
  const [sentHref, setSentHref] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const found = variant === 'school' ? demoRequestProblem(values) : schoolIntroProblem(values);
    if (found) {
      setProblem({ message: labels.errors[found.code], fields: found.fields });
      return;
    }
    let href: string;
    if (variant === 'school') {
      const request = DemoRequestSchema.parse(values);
      href = buildRequestMailto(
        to,
        request.school,
        [
          [labels.name, request.name],
          [labels.email, request.email],
          [labels.school, request.school],
          [labels.place, request.country],
          [labels.students, labels.studentsOptions[request.students]],
          [labels.curriculum, labels.curriculumOptions[request.curriculum]],
        ],
        labels.mail,
      );
    } else {
      const request = SchoolIntroRequestSchema.parse(values);
      href = buildRequestMailto(
        to,
        request.school,
        [
          [labels.name, request.name],
          [labels.email, request.email],
          [labels.school, request.school],
          [labels.place, request.city],
          [labels.noteInEmail, request.note],
        ],
        labels.mail,
      );
    }
    setProblem(null);
    setSentHref(href);
    openEmail(href);
    requestAnimationFrame(() => doneRef.current?.focus());
  };

  const invalid = (field: Field) => problem?.fields.includes(field) ?? false;
  const input = (
    field: Field,
    extra: { type?: string; autoComplete: string; required?: boolean },
  ) => (
    <input
      name={field}
      type={extra.type ?? 'text'}
      autoComplete={extra.autoComplete}
      required={extra.required ?? true}
      aria-invalid={invalid(field) || undefined}
      aria-describedby={errorId}
      className={control}
    />
  );
  const [beforeEmail, afterEmail] = labels.fallback.split(labels.emailMarker);

  if (sentHref) {
    return (
      <div role="status" className="flex min-h-[320px] flex-col items-start justify-center gap-3.5">
        <div aria-hidden="true" className="size-24 motion-safe:animate-bob [animation-duration:2s]">
          {cheer}
        </div>
        <h3
          ref={doneRef}
          tabIndex={-1}
          className="m-0 text-[30px] font-extrabold tracking-[-.03em] outline-none"
        >
          {labels.sent}
        </h3>
        <p className="m-0 text-base text-site-on-navy-2">
          {beforeEmail}
          <a href={sentHref} className={cn('text-site-lime', focusRing)}>
            {to}
          </a>
          {afterEmail}
        </p>
        <button
          type="button"
          onClick={() => {
            setSentHref(null);
            requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus());
          }}
          className={cn(
            'cursor-pointer rounded-xl border-2 border-solid border-site-navy-border bg-transparent px-4 py-2.5 font-semibold text-site-on-navy',
            focusRing,
          )}
        >
          {labels.again}
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5"
    >
      <label className={fieldLabel}>
        {labels.name}
        {input('name', { autoComplete: 'name' })}
      </label>
      <label className={fieldLabel}>
        {labels.email}
        {input('email', { type: 'email', autoComplete: 'email' })}
      </label>
      <label className={fieldLabel}>
        {labels.school}
        {input('school', { autoComplete: 'organization' })}
      </label>
      {variant === 'school' ? (
        <>
          <label className={fieldLabel}>
            {labels.place}
            {input('country', { autoComplete: 'country-name', required: false })}
          </label>
          <label className={fieldLabel}>
            {labels.students}
            <select
              name="students"
              defaultValue="under_300"
              aria-invalid={invalid('students') || undefined}
              className={control}
            >
              {StudentsBand.options.map((band) => (
                <option key={band} value={band}>
                  {labels.studentsOptions[band]}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            {labels.curriculum}
            <select
              name="curriculum"
              defaultValue="ib"
              aria-invalid={invalid('curriculum') || undefined}
              className={control}
            >
              {DemoCurriculum.options.map((curriculum) => (
                <option key={curriculum} value={curriculum}>
                  {labels.curriculumOptions[curriculum]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className={fieldLabel}>
            {labels.place}
            {input('city', { autoComplete: 'address-level2', required: false })}
          </label>
          <label className={cn(fieldLabel, 'col-span-full')}>
            {labels.note}
            <textarea
              name="note"
              rows={3}
              placeholder={labels.notePlaceholder}
              aria-invalid={invalid('note') || undefined}
              aria-describedby={errorId}
              className={cn(control, 'resize-y')}
            />
          </label>
        </>
      )}
      <p
        id={errorId}
        role="alert"
        className="col-span-full m-0 min-h-[1em] text-sm font-bold text-site-pink"
      >
        {problem?.message}
      </p>
      <div className="col-span-full mt-1 flex flex-col gap-2.5">
        <button type="submit" className={cn(button(), 'w-full justify-between')}>
          {labels.submit}
          <span aria-hidden="true">→</span>
        </button>
        <span className="text-xs text-site-on-navy-3">{labels.privacy}</span>
      </div>
    </form>
  );
}
