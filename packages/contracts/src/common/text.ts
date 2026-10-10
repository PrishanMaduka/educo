/**
 * Any control character but the line feed (Unicode `Cc`: C0, DEL and C1), and any invisible
 * format character (`Cf`: bidi overrides and isolates such as U+202E, zero-width spaces, the byte
 * order mark, soft hyphens) but the zero-width joiner and non-joiner, which Sinhala and Tamil
 * spelling needs (D32). Text that people type and staff later read keeps line breaks at most and
 * nothing else unseen, and cannot display reordered text.
 */
export const HIDDEN_CHARACTER = /[^\P{Cc}\n]|[^\P{Cf}\u200C\u200D]/u;

/**
 * The Unicode line and paragraph separators (`Zl`, `Zp`). Some mail clients and editors render
 * them as a new line, and the Leads list would not, so they are refused in every field: a
 * multi-line field keeps the line feed as its only line break.
 */
const UNICODE_SEPARATOR = /[\p{Zl}\p{Zp}]/u;

/**
 * True when `text` holds a character `HIDDEN_CHARACTER` refuses, a Unicode line or paragraph
 * separator, or a line feed where line breaks are not allowed (a single-line field, such as a
 * name that may reach an email subject).
 */
export function hasHiddenCharacter(text: string, { lineBreaks }: { lineBreaks: boolean }): boolean {
  return (
    HIDDEN_CHARACTER.test(text) ||
    UNICODE_SEPARATOR.test(text) ||
    (!lineBreaks && text.includes('\n'))
  );
}
