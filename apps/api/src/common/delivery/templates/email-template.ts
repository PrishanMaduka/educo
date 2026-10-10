import { escapeHtml, formatMessage } from './render';

import type { MessageKey, MessageValues } from './render';
import type { z } from 'zod';

/** Who an email is from (D19): a school ("{School} via Quad") or Quad itself (account mail). */
export type EmailSender = 'school' | 'account';

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** The Reply-To the template asks for (the requester, on the sales email); else the sender's. */
  readonly replyTo?: string;
}

export interface RenderOptions {
  /** The sending school's name for school mail; null for account mail. */
  readonly school: string | null;
  /** `PUBLIC_WEB_URL`: every link in an email leads there, unless it is a console link. */
  readonly publicWebUrl: string;
  /** `CONSOLE_URL`: needed only by an email for Quad staff that links to the console. */
  readonly consoleUrl?: string;
}

/** A paragraph: one message, or several messages as lines of one paragraph. */
export type Paragraph = MessageKey | readonly MessageKey[];

/** What a template is made of. Every string is a catalogue key, formatted with `values`. */
export interface EmailTemplateSpec<S extends z.ZodType<object>> {
  readonly sender: EmailSender;
  readonly params: S;
  /** ICU values for the messages; `school` is added for school mail. */
  readonly values: (params: z.output<S>) => MessageValues;
  /** The greeting's name, when the template has one. */
  readonly name?: (params: z.output<S>) => string | undefined;
  /** The subject, or a function choosing it (one per kind of request). */
  readonly subject: MessageKey | ((params: z.output<S>) => MessageKey);
  /** The body paragraphs, or a function choosing them (only the filled fields, say). */
  readonly body: readonly Paragraph[] | ((params: z.output<S>) => readonly Paragraph[]);
  readonly action?: {
    readonly label: MessageKey;
    readonly link: (params: z.output<S>) => string;
    /** Where the link must lead: the web app (default) or the console (staff mail only). */
    readonly to?: 'web' | 'console';
  };
  readonly after?: readonly MessageKey[];
  /** Reply-To for this email instead of the sender's (school office or support inbox). */
  readonly replyTo?: (params: z.output<S>) => string | undefined;
  /** The footer instead of the sender's default. */
  readonly footer?: MessageKey;
  /** A link under the footer, to a page of the web app (`/legal/privacy`). */
  readonly footerLink?: { readonly label: MessageKey; readonly path: `/${string}` };
}

export interface EmailTemplate<S extends z.ZodType<object> = z.ZodType<object>> {
  readonly sender: EmailSender;
  readonly params: S;
  /** Checks `params` against the template, then renders the subject, text and HTML. */
  readonly render: (params: unknown, options: RenderOptions) => RenderedEmail;
}

/**
 * Only links into the web app (`PUBLIC_WEB_URL`) may appear in an email, or into the console
 * (`CONSOLE_URL`) for a template that says so.
 */
function checkedLink(link: string, base: string | undefined, variable: string): string {
  if (base === undefined) throw new Error(`An email link needs ${variable}.`);
  const url = new URL(link);
  if (url.origin !== new URL(base).origin) {
    throw new Error(`An email link must point at ${variable}.`);
  }
  return url.href;
}

/** The rendered email's Reply-To, only when the template names one. */
const replyToOf = (replyTo: string | undefined): { replyTo?: string } =>
  replyTo === undefined ? {} : { replyTo };

/** Plain text in HTML: escaped, with its line breaks kept. */
const htmlText = (content: string): string => escapeHtml(content).replace(/\n/g, '<br>\n');

/**
 * Builds a template from its parts. The text and HTML have the same content: a greeting, the
 * body paragraphs, the action (label and link), the paragraphs after it and the footer. The HTML
 * escapes every value and carries no styling.
 */
export function defineEmailTemplate<S extends z.ZodType<object>>(
  spec: EmailTemplateSpec<S>,
): EmailTemplate<S> {
  return {
    sender: spec.sender,
    params: spec.params,
    render: (raw, { school, publicWebUrl, consoleUrl }) => {
      if ((spec.sender === 'school') !== (school !== null)) {
        throw new Error(
          spec.sender === 'school'
            ? 'A school email needs the sending school.'
            : 'An account email is sent by Quad, not a school.',
        );
      }
      const params: z.output<S> = spec.params.parse(raw);
      const values: MessageValues =
        school === null ? spec.values(params) : { ...spec.values(params), school };
      const name = spec.name?.(params);
      const greeting =
        name === undefined
          ? formatMessage('email.greeting.plain')
          : formatMessage('email.greeting.named', { name });
      const paragraphs = typeof spec.body === 'function' ? spec.body(params) : spec.body;
      // Each paragraph as its lines.
      const body = paragraphs.map((paragraph) =>
        (typeof paragraph === 'string' ? [paragraph] : paragraph).map((key) =>
          formatMessage(key, values),
        ),
      );
      const after = (spec.after ?? []).map((key) => formatMessage(key, values));
      const footer =
        spec.footer !== undefined
          ? formatMessage(spec.footer, values)
          : school === null
            ? formatMessage('email.footer.account')
            : formatMessage('email.footer.school', { school });
      const link = (label: string, href: string) => ({ label, href });
      const action =
        spec.action === undefined
          ? undefined
          : link(
              formatMessage(spec.action.label, values),
              spec.action.to === 'console'
                ? checkedLink(spec.action.link(params), consoleUrl, 'CONSOLE_URL')
                : checkedLink(spec.action.link(params), publicWebUrl, 'PUBLIC_WEB_URL'),
            );
      const footerLink =
        spec.footerLink === undefined
          ? undefined
          : link(
              formatMessage(spec.footerLink.label),
              new URL(spec.footerLink.path, publicWebUrl).href,
            );

      const text = [
        greeting,
        ...body.map((lines) => lines.join('\n')),
        ...(action === undefined ? [] : [`${action.label}:\n${action.href}`]),
        ...after,
        [
          `--\n${footer}`,
          ...(footerLink === undefined ? [] : [`${footerLink.label}: ${footerLink.href}`]),
        ].join('\n'),
      ].join('\n\n');
      const paragraph = (lines: readonly string[]): string =>
        `<p>${lines.map(htmlText).join('<br>\n')}</p>`;
      const anchor = ({ label, href }: { label: string; href: string }): string =>
        `<p><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`;
      const html = [
        '<!doctype html>',
        '<html lang="en"><body>',
        paragraph([greeting]),
        ...body.map(paragraph),
        ...(action === undefined ? [] : [anchor(action)]),
        ...after.map((line) => paragraph([line])),
        '<hr>',
        paragraph([footer]),
        ...(footerLink === undefined ? [] : [anchor(footerLink)]),
        '</body></html>',
      ].join('\n');
      const subject = typeof spec.subject === 'function' ? spec.subject(params) : spec.subject;
      return {
        subject: formatMessage(subject, values),
        text: `${text}\n`,
        html: `${html}\n`,
        ...replyToOf(spec.replyTo?.(params)),
      };
    },
  };
}
