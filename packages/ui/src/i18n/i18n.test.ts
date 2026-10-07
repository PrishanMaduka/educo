import en from '@quad/contracts/i18n/en.json';
import { describe, expect, it } from 'vitest';

import { createI18n, SLOT_MARKER, splitAround, t } from './index';

describe('i18n', () => {
  it('reads flat dotted keys from en.json', () => {
    expect(t('notFound.action')).toBe(en['notFound.action']);
  });

  it('formats ICU placeholders and plurals', () => {
    expect(t('theme.current', { theme: 'Dark' })).toBe('Theme: Dark');
    expect(t('students.count', { count: 1 })).toBe('1 student');
    expect(t('students.count', { count: 12 })).toBe('12 students');
  });

  it('is ready synchronously', () => {
    expect(createI18n().isInitialized).toBe(true);
  });

  it('splits a message around a slot', () => {
    const message = t('home.staff.greeting', { greeting: 'Good morning', name: SLOT_MARKER });
    expect(splitAround(message, SLOT_MARKER)).toEqual(['Good morning, ', '']);
    expect(splitAround('no slot here', SLOT_MARKER)).toEqual(['no slot here', '']);
  });
});
