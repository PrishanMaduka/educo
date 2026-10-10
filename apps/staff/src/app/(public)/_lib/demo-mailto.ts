import type { DemoFormRequest } from './demo-checks';
import type { DemoRequest } from '@quad/contracts/public';

/**
 * Translated text for the pre-launch request emails (decision log D30). The server translates
 * it with markers where the values go, so the browser needs no i18n code.
 */
export interface MailText {
  /** The subject, with `marker.slot` where the school's name goes. */
  subject: string;
  intro: string;
  /** One body line, with `marker.label` and `marker.value`. */
  line: string;
  marker: { slot: string; label: string; value: string };
}

/** Replaces every `marker` in a translated template with `value`. */
export function fillSlot(template: string, marker: string, value: string): string {
  return template.split(marker).join(value);
}

/**
 * The `mailto:` link that opens the visitor's email app with their request ready to send: the
 * school in the subject, then one line per field that has a value, in the form's order. RFC 6068:
 * percent-encoding with CRLF line breaks (`encodeURIComponent`, so spaces are `%20`, never `+`).
 */
export function buildRequestMailto(
  to: string,
  school: string,
  fields: readonly (readonly [label: string, value: string | undefined])[],
  text: MailText,
): string {
  const lines = fields
    .filter(
      (field): field is readonly [string, string] => field[1] !== undefined && field[1] !== '',
    )
    .map(([label, value]) =>
      fillSlot(fillSlot(text.line, text.marker.label, label), text.marker.value, value),
    );
  const subject = fillSlot(text.subject, text.marker.slot, school);
  const body = [text.intro, '', ...lines].join('\r\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The form labels a request's email needs (`DemoFormLabels` carries them). */
export interface RequestMailLabels {
  name: string;
  email: string;
  school: string;
  place: string;
  students: string;
  curriculum: string;
  noteInEmail: string;
  studentsOptions: Readonly<Record<DemoRequest['students'], string>>;
  curriculumOptions: Readonly<Record<DemoRequest['curriculum'], string>>;
  mail: MailText;
}

/**
 * A checked request as a `mailto:` link (D30): the pre-launch form opens it, and the live form
 * offers it when the request cannot be sent (D57).
 */
export function requestMailto(
  to: string,
  labels: RequestMailLabels,
  request: DemoFormRequest,
): string {
  const fields: [string, string | undefined][] =
    request.kind === 'school'
      ? [
          [labels.name, request.name],
          [labels.email, request.email],
          [labels.school, request.school],
          [labels.place, request.country],
          [labels.students, labels.studentsOptions[request.students]],
          [labels.curriculum, labels.curriculumOptions[request.curriculum]],
        ]
      : [
          [labels.name, request.name],
          [labels.email, request.email],
          [labels.school, request.school],
          [labels.place, request.city],
          [labels.noteInEmail, request.note],
        ];
  return buildRequestMailto(to, request.school, fields, labels.mail);
}
