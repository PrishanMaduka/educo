import { describe, expect, it } from 'vitest';

import { pingDatabase, withDatabaseName } from '../src/internal';

import { useTestDatabase } from './setup';

const testDb = useTestDatabase();

describe('pingDatabase', () => {
  it('returns true when the database answers', async () => {
    expect(await pingDatabase(testDb().appUrl)).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const url = new URL(testDb().appUrl);
    url.password = 'wrong';
    expect(await pingDatabase(url.toString())).toBe(false);
  });

  it('returns false for a database that does not exist', async () => {
    expect(await pingDatabase(withDatabaseName(testDb().appUrl, 'quad_missing_db'))).toBe(false);
  });

  it('returns false when nothing listens on the port', async () => {
    expect(await pingDatabase('postgres://quad_app:quad_app@127.0.0.1:1/quad')).toBe(false);
  });

  it('returns false for a malformed url', async () => {
    expect(await pingDatabase('not a url')).toBe(false);
  });
});
