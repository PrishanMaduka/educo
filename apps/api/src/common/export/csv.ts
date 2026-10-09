import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * CSV exports (spec 06 Conventions: lists with an Export button also answer `Accept: text/csv`).
 * The list's route picks the format from the `Accept` header; the service checks the export
 * permission and audits the export; this file only writes the text and the response headers.
 */

export type CsvCell = string | number | boolean | null;

/** U+FEFF, so spreadsheet apps read the file as UTF-8. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;
/** A cell a spreadsheet would read as a formula (CSV injection): it is kept as text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cellOf(value: CsvCell): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * RFC 4180 text: a header row then one line per row, CRLF line ends, and a UTF-8 byte order
 * mark so spreadsheet apps read names in any script correctly. Cells that start like a formula
 * get a leading apostrophe, so a name such as `=HYPERLINK(…)` never runs when opened.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(cellOf).join(','));
  return `${BYTE_ORDER_MARK}${lines.join('\r\n')}\r\n`;
}

/** Whether the request asks for CSV: `text/csv` is one of its `Accept` media types. */
export function wantsCsv(request: Pick<FastifyRequest, 'headers'>): boolean {
  const accept = request.headers.accept;
  if (accept === undefined) return false;
  return accept
    .split(',')
    .some((range) => range.split(';')[0]?.trim().toLowerCase() === 'text/csv');
}

/**
 * Marks a route that answers JSON or CSV from one URL as varying on `Accept`, so a shared or
 * browser cache never hands one format to a request for the other (Task 15 review M3). Call it
 * before choosing the format, so both answers carry it.
 */
export function varyOnAccept(reply: FastifyReply): void {
  void reply.header('vary', 'Accept');
}

/**
 * Sends `csv` as a download named `<name>-<YYYY-MM-DD>.csv` (the UTC date of `now`). Exports
 * hold personal data, so no cache keeps a copy.
 */
export function sendCsv(reply: FastifyReply, name: string, now: Date, csv: string): string {
  const file = `${name}-${now.toISOString().slice(0, 10)}.csv`;
  void reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${file}"`)
    .header('cache-control', 'no-store');
  return csv;
}
