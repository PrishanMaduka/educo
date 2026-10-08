import type { DemoCurriculum, DemoRequest, StudentsBand } from '@quad/contracts/public';

/**
 * Translated text for the pre-launch demo email (decision log, 2026-10-08). The server translates
 * it, with markers where the values go, so the browser needs no i18n code.
 */
export interface DemoMailLabels {
  /** The subject, with `marker.slot` where the school's name goes. */
  subject: string;
  intro: string;
  /** One body line, with `marker.label` and `marker.value`. */
  line: string;
  fields: Record<keyof DemoRequest, string>;
  students: Record<StudentsBand, string>;
  curricula: Record<DemoCurriculum, string>;
  marker: { slot: string; label: string; value: string };
}

/** Replaces every `marker` in a translated template with `value`. */
export function fillSlot(template: string, marker: string, value: string): string {
  return template.split(marker).join(value);
}

const FIELD_ORDER = ['name', 'email', 'school', 'country', 'students', 'curriculum'] as const;

/**
 * The `mailto:` link that opens the visitor's email app with their demo request ready to send:
 * the school in the subject, every field on its own line. RFC 6068: percent-encoding with CRLF
 * line breaks (`encodeURIComponent`, so spaces are `%20`, never `+`).
 */
export function buildDemoMailto(to: string, request: DemoRequest, labels: DemoMailLabels): string {
  const value = (field: (typeof FIELD_ORDER)[number]): string => {
    if (field === 'students') return labels.students[request.students];
    if (field === 'curriculum') return labels.curricula[request.curriculum];
    return request[field];
  };
  const lines = FIELD_ORDER.map((field) =>
    fillSlot(
      fillSlot(labels.line, labels.marker.label, labels.fields[field]),
      labels.marker.value,
      value(field),
    ),
  );
  const subject = fillSlot(labels.subject, labels.marker.slot, request.school);
  const body = [labels.intro, '', ...lines].join('\r\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
