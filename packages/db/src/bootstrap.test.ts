import { describe, expect, it } from 'vitest';

import { adminClientConfig } from './bootstrap';

describe('adminClientConfig', () => {
  it('points an admin URL at the target database', () => {
    expect(adminClientConfig('postgres://postgres:postgres@localhost:5432/quad', 'qbt_1')).toEqual({
      connectionString: 'postgres://postgres:postgres@localhost:5432/qbt_1',
      application_name: 'quad-db-bootstrap',
    });
  });

  it('passes connection parts through as a config object, with TLS verified', () => {
    const config = adminClientConfig(
      {
        host: 'db.example.internal',
        port: 5432,
        user: 'quad_admin',
        password: 'p@ss:/w?rd#%',
        ssl: { rejectUnauthorized: true, ca: 'CA PEM' },
      },
      'quad',
    );
    expect(config).toEqual({
      host: 'db.example.internal',
      port: 5432,
      user: 'quad_admin',
      password: 'p@ss:/w?rd#%',
      database: 'quad',
      ssl: { rejectUnauthorized: true, ca: 'CA PEM' },
      application_name: 'quad-db-bootstrap',
    });
    expect(config).not.toHaveProperty('connectionString');
  });

  it('refuses an unsafe database name', () => {
    expect(() => adminClientConfig('postgres://u:p@h/quad', 'quad; drop')).toThrow(
      /Unsafe database name/,
    );
    expect(() =>
      adminClientConfig(
        {
          host: 'h',
          port: 5432,
          user: 'u',
          password: 'p',
          ssl: { rejectUnauthorized: true, ca: 'CA' },
        },
        'Quad-1',
      ),
    ).toThrow(/Unsafe database name/);
  });
});
