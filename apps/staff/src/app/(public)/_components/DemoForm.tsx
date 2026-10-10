'use client';

import { cn } from '@quad/ui';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { requestMailto, type MailText } from '../_lib/demo-mailto';
import { track } from '../_lib/track';
import {
  prepareDemoRequest,
  submitDemoRequest,
  TurnstileField,
  type DemoRequestOutcome,
  type TurnstileHandle,
  type TurnstileSetup,
} from '../_live';

import { DemoDone } from './DemoDone';
import { button, focusRing, inlineLink } from './styles';

import type * as DemoChecks from '../_lib/demo-checks';
import type { DemoField, DemoFormRequest } from '../_lib/demo-checks';
import type { DemoCurriculum, PublicFormProblemCode, StudentsBand } from '@quad/contracts/public';

/** A sentence split around the support address, which the form shows as a link. */
export interface AroundEmail {
  before: string;
  after: string;
}

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
  /** In the form's order. */
  studentsOptions: Record<StudentsBand, string>;
  /** In the form's order. */
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

/** The endpoint form's own labels and messages (D57), passed only when it sends to Quad. */
export interface DemoSendLabels {
  sending: string;
  thanks: string;
  captchaFailed: string;
  rateLimited: AroundEmail;
  /** A 503, a network error, a timeout, or no Turnstile token. */
  unavailable: AroundEmail;
  /** The honeypot's label, which no person sees. */
  honeypot: string;
  /** The privacy line with Turnstile, split around the privacy policy link. */
  protectedNote: { before: string; link: string; after: string };
}

/** How a valid request leaves: the visitor's email app (pre-launch, D30) or Quad's endpoint. */
export type DemoFormDelivery =
  { mode: 'mailto' } | { mode: 'endpoint'; turnstile: TurnstileSetup; sendLabels: DemoSendLabels };

/** Where the endpoint form's privacy line leads (the policy's section on demo requests). */
const PRIVACY_HREF = '/legal/privacy#website';
/** How near the screen the demo section is when the checks start loading. */
const NEAR_SCREEN = '600px 0px';

type Checks = typeof DemoChecks;
let checks: Checks | null = null;
let loadingChecks: Promise<Checks> | null = null;

/** Loads the checks' chunk (Zod and the contracts) once; a failed load is tried again. */
function loadChecks(): Promise<Checks> {
  loadingChecks ??= import('../_lib/demo-checks').then(
    (loaded) => (checks = loaded),
    (error: unknown) => {
      loadingChecks = null;
      throw error;
    },
  );
  return loadingChecks;
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

type Problem =
  | { message: string; fields: DemoField[] }
  /** Sending failed: the message offers the request as an email (`href`). */
  | { fallback: AroundEmail; href: string; fields: DemoField[] };

/**
 * The demo panel's form (spec 19): a demo request for schools, or "tell my school" for parents.
 * The checks are the shared contracts, loaded as their own chunk when the form nears the screen.
 * In `mailto` mode (the pre-launch site, D30) a valid request opens the visitor's email app,
 * addressed to `to`. In `endpoint` mode it goes to Quad with a Turnstile token (D57), and if it
 * cannot be sent the same email is offered, so the visitor never loses the request.
 */
export function DemoForm({
  variant,
  to,
  labels,
  cheer,
  ...delivery
}: {
  variant: 'school' | 'parent';
  to: string;
  labels: DemoFormLabels;
  /** Maya's face, cheering when the request is ready. */
  cheer: ReactNode;
} & DemoFormDelivery) {
  const errorId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState<{ emailHref: string } | { thanks: true } | null>(null);
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const live = delivery.mode === 'endpoint';
  const sendLabels = delivery.mode === 'endpoint' ? delivery.sendLabels : null;

  // Near the screen, fetch the checks (and the request code when live), never at first paint.
  useEffect(() => {
    const form = formRef.current;
    if (form === null) return undefined;
    const prepare = () => {
      loadChecks().catch(() => undefined);
      if (live) prepareDemoRequest();
    };
    if (typeof IntersectionObserver === 'undefined') {
      prepare();
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        prepare();
      },
      { rootMargin: NEAR_SCREEN },
    );
    observer.observe(form);
    return () => {
      observer.disconnect();
    };
  }, [done, live]);

  const onFirstFocus = () => {
    if (focused) return;
    setFocused(true);
    loadChecks().catch(() => undefined);
    if (live) prepareDemoRequest();
  };

  const mailtoFor = (request: DemoFormRequest) => requestMailto(to, labels, request);

  // Focus the outcome once it is on the screen: after an async send, a frame callback could run
  // before React commits it.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const showDone = (next: { emailHref: string } | { thanks: true }) => {
    setProblem(null);
    setDone(next);
  };

  const send = async (
    loaded: Checks,
    request: DemoFormRequest,
    website: string,
    texts: DemoSendLabels,
  ) => {
    setSending(true);
    setProblem(null);
    let outcome: DemoRequestOutcome;
    try {
      const token = await (turnstile.current?.token() ??
        Promise.reject(new Error('Turnstile is not on the page.')));
      outcome = await submitDemoRequest(
        loaded.demoRequestBody(request, { turnstileToken: token, website }),
      );
    } catch {
      // No token (Cloudflare unreachable or blocked): offer the email.
      outcome = { kind: 'unavailable' };
    }
    setSending(false);
    if (outcome.kind === 'sent') {
      showDone({ thanks: true });
      // No parameters, so nothing the visitor typed can reach analytics.
      track(variant === 'school' ? 'demo_requested' : 'parent_request_sent');
      return;
    }
    // Each token is single-use, so the next try needs a fresh one.
    turnstile.current?.reset();
    switch (outcome.kind) {
      case 'invalid': {
        const found = loaded.problemAt(variant, outcome.paths);
        setProblem({ message: labels.errors[found.code], fields: found.fields });
        return;
      }
      case 'captcha_failed':
        setProblem({ message: texts.captchaFailed, fields: [] });
        return;
      case 'rate_limited':
        setProblem({ fallback: texts.rateLimited, href: mailtoFor(request), fields: [] });
        return;
      case 'unavailable':
        setProblem({ fallback: texts.unavailable, href: mailtoFor(request), fields: [] });
        return;
      default: {
        const never: never = outcome;
        throw new Error(`Unknown outcome ${JSON.stringify(never)}`);
      }
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const website = typeof values.website === 'string' ? values.website : '';
    const handle = (loaded: Checks) => {
      const checked = loaded.checkDemoForm(variant, values);
      if (!checked.ok) {
        setProblem({
          message: labels.errors[checked.problem.code],
          fields: checked.problem.fields,
        });
        return;
      }
      if (sendLabels) {
        void send(loaded, checked.request, website, sendLabels);
        return;
      }
      const href = mailtoFor(checked.request);
      showDone({ emailHref: href });
      openEmail(href);
    };
    // Usually loaded on the first focus already, so the email opens in the visitor's own click.
    if (checks) {
      handle(checks);
      return;
    }
    loadChecks().then(handle, () => {
      // Offline before the checks arrived: the plain address still reaches Quad.
      const href = `mailto:${to}`;
      if (sendLabels) {
        setProblem({ fallback: sendLabels.unavailable, href, fields: [] });
        return;
      }
      showDone({ emailHref: href });
      openEmail(href);
    });
  };

  const invalid = (field: DemoField) => problem?.fields.includes(field) ?? false;
  const input = (
    field: DemoField,
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

  if (done) {
    return (
      <DemoDone
        ref={doneRef}
        cheer={cheer}
        title={'thanks' in done && sendLabels ? sendLabels.thanks : labels.sent}
        email={
          'emailHref' in done
            ? { href: done.emailHref, to, before: beforeEmail ?? '', after: afterEmail ?? '' }
            : null
        }
        again={labels.again}
        onAgain={() => {
          setDone(null);
          requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus());
        }}
      />
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      onFocus={onFirstFocus}
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
              {Object.entries(labels.studentsOptions).map(([band, label]) => (
                <option key={band} value={band}>
                  {label}
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
              {Object.entries(labels.curriculumOptions).map(([curriculum, label]) => (
                <option key={curriculum} value={curriculum}>
                  {label}
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
      {sendLabels && (
        // The honeypot (D57): out of sight, out of the tab order and hidden from screen readers,
        // so only a bot fills it. The API answers as usual and drops the request.
        <label aria-hidden="true" className="sr-only">
          {sendLabels.honeypot}
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      )}
      <p
        id={errorId}
        role="alert"
        className="col-span-full m-0 min-h-[1em] text-sm font-bold text-site-pink"
      >
        {problem && 'message' in problem && problem.message}
        {problem && 'fallback' in problem && (
          <>
            {problem.fallback.before}
            <a href={problem.href} className={inlineLink}>
              {to}
            </a>
            {problem.fallback.after}
          </>
        )}
      </p>
      <div className="col-span-full mt-1 flex flex-col gap-2.5">
        {delivery.mode === 'endpoint' && (
          <TurnstileField ref={turnstile} setup={delivery.turnstile} active={focused} />
        )}
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending || undefined}
          className={cn(button(), 'w-full justify-between disabled:cursor-wait')}
        >
          {sending && sendLabels ? sendLabels.sending : labels.submit}
          <span aria-hidden="true">→</span>
        </button>
        <span className="text-xs text-site-on-navy-3">
          {sendLabels ? (
            <>
              {sendLabels.protectedNote.before}
              <a href={PRIVACY_HREF} className={cn('text-inherit underline', focusRing)}>
                {sendLabels.protectedNote.link}
              </a>
              {sendLabels.protectedNote.after}
            </>
          ) : (
            labels.privacy
          )}
        </span>
      </div>
    </form>
  );
}
