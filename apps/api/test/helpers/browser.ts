import { randomBytes } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse as Response } from 'fastify';

/** A fresh client address, so each browser has its own per-IP rate-limit bucket. */
export const randomIp = (): string => `10.${[...randomBytes(3)].join('.')}`;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface BrowserRequestOptions {
  /** Send `X-CSRF-Token` from the CSRF cookie (default true), as the web app does on writes. */
  readonly csrf?: boolean;
  readonly headers?: Record<string, string>;
}

/**
 * A browser for the API tests: it keeps the cookies the API sets (and drops the ones it clears),
 * sends them back, and echoes the CSRF cookie in `X-CSRF-Token` like the staff web app. Each
 * browser has its own client address.
 */
export class Browser {
  readonly cookies = new Map<string, string>();
  /** The cookie echoed in `X-CSRF-Token`: the console app echoes its own (Task 10). */
  csrfCookie = 'quad_csrf';

  constructor(
    private readonly app: () => NestFastifyApplication,
    readonly ip: string = randomIp(),
    private readonly userAgent?: string,
  ) {}

  get(url: string, options: BrowserRequestOptions = {}): Promise<Response> {
    return this.request('GET', url, undefined, options);
  }

  post(url: string, body?: unknown, options: BrowserRequestOptions = {}): Promise<Response> {
    return this.request('POST', url, body, options);
  }

  async request(
    method: Method,
    url: string,
    body?: unknown,
    options: BrowserRequestOptions = {},
  ): Promise<Response> {
    const cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const csrf = this.cookies.get(this.csrfCookie);
    const response = await this.app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url: `/api/v1${url}`,
        remoteAddress: this.ip,
        headers: {
          ...(cookie === '' ? {} : { cookie }),
          ...(options.csrf !== false && csrf !== undefined ? { 'x-csrf-token': csrf } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(this.userAgent === undefined ? {} : { 'user-agent': this.userAgent }),
          ...options.headers,
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
    this.absorb(response);
    return response;
  }

  /** A copy with the same cookies and address (the same device in another tab). */
  clone(): Browser {
    const copy = new Browser(this.app, this.ip, this.userAgent);
    copy.csrfCookie = this.csrfCookie;
    for (const [name, value] of this.cookies) copy.cookies.set(name, value);
    return copy;
  }

  private absorb(response: Response): void {
    for (const cookie of response.cookies as readonly SetCookie[]) {
      const cleared =
        cookie.value === '' ||
        cookie.maxAge === 0 ||
        (cookie.expires !== undefined && cookie.expires.getTime() <= Date.now());
      if (cleared) this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, cookie.value);
    }
  }
}

/** One `Set-Cookie`, as light-my-request parses it. */
export interface SetCookie {
  readonly name: string;
  readonly value: string;
  readonly maxAge?: number;
  readonly expires?: Date;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: string;
  readonly path?: string;
}

/** The `Set-Cookie` named `name` on a response, if any. */
export function setCookie(response: Response, name: string): SetCookie | undefined {
  return (response.cookies as readonly SetCookie[]).find((cookie) => cookie.name === name);
}
