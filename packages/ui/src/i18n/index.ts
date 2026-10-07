import en from '@quad/contracts/i18n/en.json';
import i18next, { type i18n as I18n } from 'i18next';
import ICU from 'i18next-icu';

/** Every key in packages/contracts/i18n/en.json. */
export type MessageKey = keyof typeof en;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
    keySeparator: false;
    nsSeparator: false;
  }
}

/**
 * An i18next instance with the en.json strings, ICU message syntax (plurals, {name} placeholders) and flat
 * dotted keys. It initialises synchronously, so server components can call `t` straight away.
 */
export function createI18n(): I18n {
  const instance = i18next.createInstance();
  void instance.use(ICU).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}

/** The app-wide instance. Client components read it through react-i18next (`I18nProvider`). */
export const i18n = createI18n();

/** Translate on the server (or anywhere outside React). */
export const t = i18n.t.bind(i18n);

/**
 * Splits a translated message around one placeholder, so the caller can wrap that value in markup
 * (for example the highlighted first name in "Good morning, {name}") without concatenating sentences.
 */
export function splitAround(message: string, marker: string): [before: string, after: string] {
  const at = message.indexOf(marker);
  if (at < 0) return [message, ''];
  return [message.slice(0, at), message.slice(at + marker.length)];
}

/** A value no translation contains, for `splitAround`. */
export const SLOT_MARKER = '⁣slot⁣';
