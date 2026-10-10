/**
 * Any control character but the line feed (Unicode `Cc`: C0, DEL and C1), and any invisible
 * format character (`Cf`: bidi overrides and isolates such as U+202E, zero-width spaces, the byte
 * order mark, soft hyphens) but the zero-width joiner and non-joiner, which Sinhala and Tamil
 * spelling needs (D32). Text that people type and staff later read keeps line breaks at most and
 * nothing else unseen, and cannot display reordered text.
 */
export const HIDDEN_CHARACTER = /[^\P{Cc}\n]|[^\P{Cf}\u200C\u200D]/u;

const SINGLE_LINE_BREAK = /[\n\p{Zl}\p{Zp}]/u;

/**
 * True when `text` holds a character `HIDDEN_CHARACTER` refuses, or a line break where line breaks
 * are not allowed (a single-line field, such as a name that may reach an email subject). A line
 * break there is the line feed or the Unicode line and paragraph separators (`Zl`, `Zp`), which
 * some mail clients and editors also render as a new line.
 */
export function hasHiddenCharacter(text: string, { lineBreaks }: { lineBreaks: boolean }): boolean {
  return HIDDEN_CHARACTER.test(text) || (!lineBreaks && SINGLE_LINE_BREAK.test(text));
}
