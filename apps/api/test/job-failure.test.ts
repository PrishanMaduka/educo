import { describe, expect, it } from 'vitest';

import { isFinalAttempt } from '../src/worker/job-failure';

describe('isFinalAttempt', () => {
  it.each([
    [{ attemptsMade: 1, opts: {} }, true],
    [{ attemptsMade: 1, opts: { attempts: 3 } }, false],
    [{ attemptsMade: 2, opts: { attempts: 3 } }, false],
    [{ attemptsMade: 3, opts: { attempts: 3 } }, true],
  ])('a job after %j attempts is final: %s', (job, expected) => {
    expect(isFinalAttempt(job, new Error('failed'))).toBe(expected);
  });

  it('treats an UnrecoverableError as final, since BullMQ will not retry it', () => {
    const error = Object.assign(new Error('bad data'), { name: 'UnrecoverableError' });
    expect(isFinalAttempt({ attemptsMade: 1, opts: { attempts: 5 } }, error)).toBe(true);
  });

  it('treats a missing job as final', () => {
    expect(isFinalAttempt(undefined, new Error('lost'))).toBe(true);
  });
});
