import { escapeHtml, formatMessage } from './render';

import type { MessageKey, MessageValues } from './render';
import type { z } from 'zod';

/** Who an email is from (D19): a school ("{School} via Quad") or Quad itself (account mail). */
export type EmailSender = 'school' | 'account';

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface RenderOptions {
  /** The sending school's name for school mail; null for account mail. */
  readonly school: string | null;
  /** `PUBLIC_WEB_URL`: every link in an email must lead there. */
  readonly publicWebUrl: string;
}

/** What a template is made of. Every string is a catalogue key, formatted with `values`. */
export interface EmailTemplateSpec<S extends z.ZodType<object>> {
  readonly sender: EmailSender;
  readonly params: S;
  /** ICU values for the messages; `school` is added for school mail. */
  readonly values: (params: z.output<S>) => MessageValues;
  /** The greeting's name, when the template has one. */
  readonly name?: (params: z.output<S>) => string | undefined;
  readonly subject: MessageKey;
  readonly body: readonly MessageKey[];
  readonly action?: { readonly label: MessageKey; readonly link: (params: z.output<S>) => string };
  readonly after?: readonly MessageKey[];
}

export interface EmailTemplate<S extends z.ZodType<object> = z.ZodType<object>> {
  readonly sender: EmailSender;
  readonly params: S;
  /** Checks `params` against the template, then renders the subject, text and HTML. */
  readonly render: (params: unknown, options: RenderOptions) => RenderedEmail;
}

/** Only links into the web app (`PUBLIC_WEB_URL`) may appear in an email. */
function checkedLink(link: string, publicWebUrl: string): string {
  const url = new URL(link);
  if (url.origin !== new URL(publicWebUrl).origin) {
    throw new Error('An email link must point at PUBLIC_WEB_URL.');
  }
  return url.href;
}

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
    render: (raw, { school, publicWebUrl }) => {
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
      const body = spec.body.map((key) => formatMessage(key, values));
      const after = (spec.after ?? []).map((key) => formatMessage(key, values));
      const footer =
        school === null
          ? formatMessage('email.footer.account')
          : formatMessage('email.footer.school', { school });
      const action =
        spec.action === undefined
          ? undefined
          : {
              label: formatMessage(spec.action.label, values),
              link: checkedLink(spec.action.link(params), publicWebUrl),
            };

      const text = [
        greeting,
        ...body,
        ...(action === undefined ? [] : [`${action.label}:\n${action.link}`]),
        ...after,
        `--\n${footer}`,
      ].join('\n\n');
      const paragraph = (content: string): string => `<p>${escapeHtml(content)}</p>`;
      const html = [
        '<!doctype html>',
        '<html lang="en"><body>',
        paragraph(greeting),
        ...body.map(paragraph),
        ...(action === undefined
          ? []
          : [`<p><a href="${escapeHtml(action.link)}">${escapeHtml(action.label)}</a></p>`]),
        ...after.map(paragraph),
        '<hr>',
        paragraph(footer),
        '</body></html>',
      ].join('\n');
      return { subject: formatMessage(spec.subject, values), text: `${text}\n`, html: `${html}\n` };
    },
  };
}
