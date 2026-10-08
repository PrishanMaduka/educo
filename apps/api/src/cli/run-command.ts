/**
 * Runs a one-off command of the api image: prints its one-line result and exits 0, or prints
 * the error message (never a URL or a password) and exits 1.
 */
export function runCommand(name: string, command: () => Promise<string>): void {
  command().then(
    (line) => {
      process.stdout.write(`${line}\n`);
      process.exit(0);
    },
    (error: unknown) => {
      process.stderr.write(`${name} failed: ${redact(error)}\n`);
      process.exit(1);
    },
  );
}

const URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const CREDENTIALS_PATTERN = /\S+:\S+@\S+/g;

/** The error's own message, or its code, or its first inner error's (AggregateError). */
function messageOf(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (error.message !== '') {
    return error.message;
  }
  if ('code' in error && typeof error.code === 'string' && error.code !== '') {
    return error.code;
  }
  if (error instanceof AggregateError) {
    const inner: readonly unknown[] = error.errors as readonly unknown[];
    const first = inner[0];
    if (first !== undefined) {
      return messageOf(first);
    }
  }
  return 'unknown error';
}

/** The error's message with connection URLs and `user:password@host` removed. */
export function redact(error: unknown): string {
  return messageOf(error)
    .replace(URL_PATTERN, '<url>')
    .replace(CREDENTIALS_PATTERN, '<credentials>');
}

/** A required environment variable, or an error naming it. */
export function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`${key} is required.`);
  }
  return value;
}
