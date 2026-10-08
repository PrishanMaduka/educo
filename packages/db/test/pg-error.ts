/** The Postgres error behind `error`: Drizzle wraps the driver error as its `cause`. */
export function postgresCause(error: unknown): unknown {
  return error instanceof Error && error.cause !== undefined ? error.cause : error;
}
