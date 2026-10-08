import { describe, expect, it } from 'vitest';

import { serviceTargets } from '../check-services.mjs';

describe('serviceTargets', () => {
  it('defaults to the compose ports on localhost', () => {
    expect(serviceTargets({})).toEqual([
      { name: 'Postgres', host: 'localhost', port: 5432 },
      { name: 'Redis', host: 'localhost', port: 6379 },
      { name: 'Mailpit', host: 'localhost', port: 1025 },
    ]);
  });

  it('reads hosts and ports from DATABASE_URL, REDIS_URL and SMTP_URL', () => {
    expect(
      serviceTargets({
        DATABASE_URL: 'postgres://quad_app:quad_app@db.internal:6543/quad',
        REDIS_URL: 'redis://cache.internal:6380',
        SMTP_URL: 'smtp://mail.internal:2525',
      }),
    ).toEqual([
      { name: 'Postgres', host: 'db.internal', port: 6543 },
      { name: 'Redis', host: 'cache.internal', port: 6380 },
      { name: 'Mailpit', host: 'mail.internal', port: 2525 },
    ]);
  });
});
