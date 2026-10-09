import { describe, expect, it } from 'vitest';

import { TotpSetupInput, TotpSetupResult } from '../index';

const pathOf = (result: { success: boolean; error?: { issues: { path: unknown[] }[] } }) =>
  result.error?.issues[0]?.path;

describe('TotpSetupInput (POST /me/totp)', () => {
  it('starts with no code and confirms with a six-digit code', () => {
    expect(TotpSetupInput.parse({})).toEqual({});
    expect(TotpSetupInput.parse({ code: '123456' })).toEqual({ code: '123456' });
  });

  it.each([{ code: '12345' }, { code: '1234567' }, { code: 123456 }])(
    'refuses %j at code',
    (input) => {
      expect(pathOf(TotpSetupInput.safeParse(input))).toEqual(['code']);
    },
  );
});

describe('TotpSetupResult', () => {
  it('is the otpauth URI on start, and the recovery codes and next step on confirm', () => {
    expect(
      TotpSetupResult.safeParse({
        otpauthUri: 'otpauth://totp/Quad:a%40b.lk?secret=ABC&issuer=Quad',
        recoveryCodes: null,
        next: null,
      }).success,
    ).toBe(true);
    expect(
      TotpSetupResult.safeParse({
        otpauthUri: null,
        recoveryCodes: Array.from({ length: 10 }, () => 'abcde-fghjk'),
        next: 'done',
      }).success,
    ).toBe(true);
  });

  it('refuses a URI that is not otpauth', () => {
    expect(
      pathOf(
        TotpSetupResult.safeParse({
          otpauthUri: 'https://example.test',
          recoveryCodes: null,
          next: null,
        }),
      ),
    ).toEqual(['otpauthUri']);
  });
});
