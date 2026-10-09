import { describe, expect, it } from 'vitest';

import { summarySentence } from './settings-summary';

const t = (key: string, values?: Record<string, string>) =>
  values === undefined ? key : `${key}${JSON.stringify(values)}`;

describe('summarySentence (the API’s summary codes in words)', () => {
  it('joins each part in order', () => {
    expect(
      summarySentence(
        [
          { code: 'ask_quad_on' },
          { code: 'quiet_hours', from: '18:00', until: '07:00', weekends: true },
        ],
        t,
      ),
    ).toBe(
      'schoolSettings.summary.askQuadOn schoolSettings.summary.quietHours{"from":"18:00","until":"07:00","weekends":"yes"}',
    );
  });

  it('says when Ask Quad and quiet hours are off', () => {
    expect(summarySentence([{ code: 'ask_quad_off' }, { code: 'quiet_hours_off' }], t)).toBe(
      'schoolSettings.summary.askQuadOff schoolSettings.summary.quietHoursOff',
    );
  });
});
