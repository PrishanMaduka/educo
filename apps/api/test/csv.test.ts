import { describe, expect, it, vi } from 'vitest';

import { sendCsv, toCsv, wantsCsv } from '../src/common/export/csv';

import type { FastifyReply } from 'fastify';

const BOM = String.fromCharCode(0xfeff);

describe('toCsv', () => {
  it('writes a header and rows with CRLF line ends and a byte order mark', () => {
    expect(
      toCsv(
        ['When', 'Who'],
        [
          ['2026-10-08T06:30:00.000Z', 'Prishan Maduka'],
          [1, true],
        ],
      ),
    ).toBe(`${BOM}When,Who\r\n2026-10-08T06:30:00.000Z,Prishan Maduka\r\n1,true\r\n`);
  });

  it.each([
    ['a, b', '"a, b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    [' padded', '" padded"'],
    [null, ''],
    ['Kandy', 'Kandy'],
  ])('quotes %j as %s', (cell, written) => {
    expect(toCsv(['x'], [[cell]])).toBe(`${BOM}x\r\n${written}\r\n`);
  });

  it.each([
    ['=HYPERLINK("http://evil.test")', `"'=HYPERLINK(""http://evil.test"")"`],
    ['+94770000001', `'+94770000001`],
    ['-1', `'-1`],
    ['@SUM(A1)', `'@SUM(A1)`],
  ])('keeps a formula-like cell %j as text', (cell, written) => {
    expect(toCsv(['x'], [[cell]])).toBe(`${BOM}x\r\n${written}\r\n`);
  });

  it('leaves numbers alone, even negative ones', () => {
    expect(toCsv(['x'], [[-1]])).toBe(`${BOM}x\r\n-1\r\n`);
  });
});

describe('wantsCsv', () => {
  it.each([
    ['text/csv', true],
    ['application/json, text/csv;q=0.9', true],
    ['TEXT/CSV; charset=utf-8', true],
    ['application/json', false],
    ['*/*', false],
    ['text/*', false],
    [undefined, false],
  ])('%s → %s', (accept, wanted) => {
    expect(wantsCsv({ headers: accept === undefined ? {} : { accept } })).toBe(wanted);
  });
});

describe('sendCsv', () => {
  it('sends a dated attachment that no cache keeps', () => {
    const headers: Record<string, string> = {};
    const reply = {
      header: vi.fn((name: string, value: string) => {
        headers[name] = value;
        return reply;
      }),
    };
    const csv = sendCsv(
      reply as unknown as FastifyReply,
      'quad-audit',
      new Date('2026-10-08T23:59:00Z'),
      'x\r\n',
    );
    expect(csv).toBe('x\r\n');
    expect(headers).toEqual({
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="quad-audit-2026-10-08.csv"',
      'cache-control': 'no-store',
    });
  });
});
