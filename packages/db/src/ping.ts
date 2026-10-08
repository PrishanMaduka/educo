import pg from 'pg';

/**
 * Opens a short-lived connection, runs `select 1` and closes it. Returns false on any failure
 * and never throws: readiness checks only need a yes or no, and the reason is not theirs to
 * report (it can contain the connection string).
 */
export async function pingDatabase(url: string, timeoutMs = 2000): Promise<boolean> {
  let client: pg.Client;
  try {
    client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
      application_name: 'quad-ping',
    });
  } catch {
    return false;
  }
  // A late socket error after a failed connect must not become an unhandled 'error' event.
  client.on('error', () => undefined);
  try {
    await client.connect();
    await client.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}
