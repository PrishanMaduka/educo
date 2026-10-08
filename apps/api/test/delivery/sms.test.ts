import { describe, expect, it } from 'vitest';

import { LogSms, maskPhone } from '../../src/common/delivery/log-sms';
import { createSmsSender } from '../../src/common/delivery/sms';
import { loadConfig } from '../../src/config';
import { captureLogs } from '../app';
import { localEnv } from '../env';

const PHONE = '+94770000001';
const MESSAGE = { to: PHONE, text: '482913 is your Quad sign-in code.', code: '482913' };

describe('maskPhone', () => {
  it.each([
    ['+94770000001', '+94 77 *** **01'],
    ['+94712345678', '+94 71 *** **78'],
    // Outside +94 (not accepted in M1, OQ12) only the last two digits show.
    ['+447700900123', '*** **23'],
    ['not a number', '***'],
  ])('masks %s as %s', (phone, masked) => {
    expect(maskPhone(phone)).toBe(masked);
  });
});

describe('the log SMS provider', () => {
  it('writes the masked number and, locally, the code (spec 02), never the full number or text', async () => {
    const { lines, logger } = captureLogs();
    await new LogSms(logger, 'local').send(MESSAGE);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ to: '+94 77 *** **01', code: '482913' });
    const output = JSON.stringify(lines);
    for (const form of [PHONE, '770000001', '0770000001', '77 000 0001', MESSAGE.text]) {
      expect(output).not.toContain(form);
    }
  });

  it.each(['staging', 'production'] as const)('leaves the code out on %s', async (appEnv) => {
    const { lines, logger } = captureLogs();
    await new LogSms(logger, appEnv).send(MESSAGE);
    expect(lines[0]).toMatchObject({ to: '+94 77 *** **01' });
    expect(JSON.stringify(lines)).not.toContain('482913');
  });
});

describe('choosing the SMS provider', () => {
  it('uses the log provider (live SMS arrives in M6, OQ12)', () => {
    const { logger } = captureLogs();
    expect(createSmsSender(loadConfig(localEnv()), logger)).toBeInstanceOf(LogSms);
    expect(createSmsSender(loadConfig(localEnv({ SMS_PROVIDER: 'log' })), logger)).toBeInstanceOf(
      LogSms,
    );
  });
});
