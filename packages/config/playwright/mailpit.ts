/**
 * Reads what the stack's worker sent, through Mailpit's HTTP API (compose: http://localhost:8025;
 * `MAILPIT_URL` overrides it, as in the API's SMTP test). Mailpit is shared by every stack and
 * test run, so messages are found by recipient and by when they arrived, never by clearing the
 * inbox: give each journey its own address where it can (`new.teacher+<run>@…`), and pass
 * `since` for a seeded person's address.
 */

export const DEFAULT_MAILPIT_URL = 'http://localhost:8025';

/** A message as Mailpit's `GET /api/v1/message/{id}` returns it (the parts the journeys use). */
export interface MailpitMessage {
  readonly id: string;
  readonly subject: string;
  readonly to: readonly string[];
  readonly text: string;
  readonly html: string;
}

export interface WaitForMessageOptions {
  /** The recipient's address, exactly. */
  readonly to: string;
  /** Only messages that arrived at or after this instant. */
  readonly since?: Date;
  /** Only messages whose subject contains this text. */
  readonly subject?: string;
  /** How long to wait for it; 15 s by default (the worker sends within a second or two). */
  readonly timeoutMs?: number;
}

type Json = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value[key]` as a string, or an error naming what Mailpit sent instead. */
function stringField(value: Json, key: string): string {
  const field = value[key];
  if (typeof field !== 'string') throw new Error(`Mailpit sent no ${key} string.`);
  return field;
}

/** `value[key]` as an array of objects. */
function objectsField(value: Json, key: string): Json[] {
  const field = value[key];
  if (!Array.isArray(field) || !field.every(isObject)) {
    throw new Error(`Mailpit sent no ${key} list.`);
  }
  return field;
}

/** The query for Mailpit's search: messages to exactly this address. */
export function recipientQuery(to: string): string {
  return `to:"${to.replaceAll('"', '')}"`;
}

/**
 * The first link in `text` whose path starts with `pathPrefix` (for example `/sign-in/reset/`),
 * as Mailpit shows it, or null. Links end at whitespace, a quote or an angle bracket.
 */
export function linkIn(text: string, pathPrefix: string): string | null {
  for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    const url = new URL(match[0]);
    if (url.pathname.startsWith(pathPrefix)) return url.href;
  }
  return null;
}

/** The token at the end of a signed-link URL (`…/sign-in/reset/{token}`). */
export function tokenOf(link: string): string {
  const token = new URL(link).pathname.split('/').pop();
  if (token === undefined || token === '') throw new Error('The link has no token.');
  return token;
}

/** A small client for Mailpit's HTTP API. */
export class Mailpit {
  constructor(
    private readonly baseUrl: string = process.env.MAILPIT_URL ?? DEFAULT_MAILPIT_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** The newest message matching `options`, waiting for it to arrive. */
  async waitForMessage(options: WaitForMessageOptions): Promise<MailpitMessage> {
    const deadline = Date.now() + (options.timeoutMs ?? 15_000);
    for (;;) {
      const found = await this.newest(options);
      if (found !== null) return found;
      if (Date.now() >= deadline) {
        throw new Error(`No email to ${options.to} arrived in Mailpit in time.`);
      }
      await new Promise((wait) => setTimeout(wait, 250));
    }
  }

  /** The newest message matching `options` now, or null. */
  async newest(options: Omit<WaitForMessageOptions, 'timeoutMs'>): Promise<MailpitMessage | null> {
    const search = await this.json(
      `/api/v1/search?query=${encodeURIComponent(recipientQuery(options.to))}`,
    );
    // Mailpit lists the newest first.
    const hit = objectsField(search, 'messages').find(
      (message) =>
        (options.since === undefined ||
          new Date(stringField(message, 'Created')) >= options.since) &&
        (options.subject === undefined ||
          stringField(message, 'Subject').includes(options.subject)),
    );
    return hit === undefined ? null : this.message(stringField(hit, 'ID'));
  }

  /** One message by id. */
  async message(id: string): Promise<MailpitMessage> {
    const message = await this.json(`/api/v1/message/${encodeURIComponent(id)}`);
    return {
      id: stringField(message, 'ID'),
      subject: stringField(message, 'Subject'),
      to: objectsField(message, 'To').map((address) => stringField(address, 'Address')),
      text: stringField(message, 'Text'),
      html: stringField(message, 'HTML'),
    };
  }

  private async json(path: string): Promise<Json> {
    const response = await this.fetcher(`${this.baseUrl}${path}`);
    if (!response.ok) throw new Error(`Mailpit answered ${String(response.status)} to ${path}.`);
    const body: unknown = await response.json();
    if (!isObject(body)) throw new Error(`Mailpit sent no object for ${path}.`);
    return body;
  }
}
