import en from '@quad/contracts/i18n/en.json';
import { IntlMessageFormat } from 'intl-messageformat';

/** A key of the shared string catalogue (`packages/contracts/i18n/en.json`). */
export type MessageKey = keyof typeof en;
/** ICU argument values. Dates are formatted by the template first, in the right time zone. */
export type MessageValues = Readonly<Record<string, string | number>>;

const compiled = new Map<MessageKey, IntlMessageFormat>();

/**
 * Formats one catalogue message as ICU (plurals included). Throws when an argument has no value,
 * so a template can never send a blank or a raw `{placeholder}`.
 */
export function formatMessage(key: MessageKey, values: MessageValues = {}): string {
  let format = compiled.get(key);
  if (format === undefined) {
    format = new IntlMessageFormat(en[key], 'en');
    compiled.set(key, format);
  }
  const text = format.format(values);
  if (typeof text !== 'string') {
    throw new Error(`The message ${key} did not format to plain text.`);
  }
  return text;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML element content and quoted attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
