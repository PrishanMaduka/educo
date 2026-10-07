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

/** The error's message with anything that looks like a connection URL removed. */
export function redact(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>');
}

/** A required environment variable, or an error naming it. */
export function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`${key} is required.`);
  }
  return value;
}
