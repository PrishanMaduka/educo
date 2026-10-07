#!/usr/bin/env node
// Smoke checks for a running Quad environment (`pnpm smoke`, D28):
//   node scripts/smoke.mjs --web <url> --console <url> [--api <url>] [--origin <url>]
//                          [--expect-noindex | --expect-indexable]
// Checks the API's readiness, the staff landing page and portal shell, the console shell, the
// X-Robots-Tag header on those four, the Socket.IO handshake, and (with --origin) that the load
// balancer refuses a request that did not come through CloudFront. Prints one line per check and
// exits 1 if any fails. It never sends the origin header, and it follows no redirects.
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';

// Node 22 globals (the lint config declares no browser globals).
const { AbortSignal, WebSocket } = globalThis;

/**
 * @typedef {{
 *   web: string,
 *   console: string,
 *   api: string,
 *   origin?: string,
 *   robots: 'noindex' | 'indexable' | 'ignore',
 *   timeoutMs: number,
 * }} SmokeOptions
 * @typedef {{ name: string, ok: boolean, detail: string }} SmokeResult
 * @typedef {{ fetch: typeof fetch, openWebSocket: (url: string) => Promise<string> }} SmokeDeps
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const URL_FLAGS = ['--web', '--console', '--api', '--origin'];
const SIGN_IN_REDIRECTS = [302, 303, 307];
const HTML_ELEMENT = /<html[\s>]/i;
// The body of the ALB listener's default fixed-response 403 (plan Task 10). A 403 from the WAF or
// CloudFront has another body, so it does not prove the ALB itself refused the request.
const ALB_FORBIDDEN_BODY = 'Forbidden';

/**
 * An http(s) base URL without a trailing slash.
 * @param {string} flag
 * @param {string | undefined} value
 * @returns {string}
 */
function baseUrl(flag, value) {
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a URL.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${flag} ${JSON.stringify(value)} is not a URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${flag} must be an http or https URL.`);
  }
  return value.replace(/\/+$/, '');
}

/**
 * @param {string[]} argv
 * @returns {SmokeOptions}
 */
export function parseSmokeArgs(argv) {
  /** @type {Record<string, string>} */
  const urls = {};
  /** @type {SmokeOptions['robots'][]} */
  const robots = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (URL_FLAGS.includes(arg)) {
      urls[arg] = baseUrl(arg, argv[i + 1]);
      i += 1;
    } else if (arg === '--expect-noindex') {
      robots.push('noindex');
    } else if (arg === '--expect-indexable') {
      robots.push('indexable');
    } else {
      throw new Error(`Unknown argument ${JSON.stringify(arg)}.`);
    }
  }
  const web = urls['--web'];
  const consoleUrl = urls['--console'];
  if (web === undefined || consoleUrl === undefined) {
    throw new Error('--web and --console are required.');
  }
  if (robots.length > 1)
    throw new Error('Pass at most one of --expect-noindex and --expect-indexable.');
  const origin = urls['--origin'];
  return {
    web,
    console: consoleUrl,
    api: urls['--api'] ?? web,
    ...(origin === undefined ? {} : { origin }),
    robots: robots[0] ?? 'ignore',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

/** @param {unknown} error */
const reason = (error) => (error instanceof Error ? error.message : String(error));

/** @param {Response} res */
const isHtml = (res) => (res.headers.get('content-type') ?? '').startsWith('text/html');

/**
 * `GET url` with no redirects followed, no extra headers and a timeout.
 * @param {SmokeDeps} deps
 * @param {SmokeOptions} options
 * @param {string} url
 */
async function get(deps, options, url) {
  return deps.fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs) });
}

/**
 * Discards a response body so its connection is released.
 * @param {Response} res
 */
async function drain(res) {
  await res.body?.cancel().catch(() => undefined);
}

/**
 * @param {Response} res
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
async function checkReady(res) {
  if (res.status !== 200) {
    await drain(res);
    return { ok: false, detail: `status ${res.status}, expected 200` };
  }
  const text = await res.text();
  /** @type {unknown} */
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, detail: 'body is not JSON' };
  }
  const status =
    typeof body === 'object' && body !== null && 'status' in body ? body.status : undefined;
  return status === 'ok'
    ? { ok: true, detail: 'status ok' }
    : { ok: false, detail: `status ${JSON.stringify(status)}, expected "ok"` };
}

/**
 * A 200 HTML page whose body has an `<html` element, so an error page served as `text/html` by a
 * proxy in front of the app does not pass.
 * @param {Response} res
 */
async function checkHtml(res) {
  if (res.status !== 200) {
    await drain(res);
    return { ok: false, detail: `status ${res.status}, expected 200` };
  }
  if (!isHtml(res)) {
    await drain(res);
    return { ok: false, detail: `content-type ${res.headers.get('content-type') ?? 'missing'}` };
  }
  if (!HTML_ELEMENT.test(await res.text())) return { ok: false, detail: 'no <html> element' };
  return { ok: true, detail: '200 text/html' };
}

/**
 * Whether `location` (relative, or absolute on the same origin) leads to `/sign-in` or below it.
 * @param {string} location
 * @param {string} requested the URL that answered with the redirect
 */
function isSignIn(location, requested) {
  if (location === '') return false;
  const target = new URL(location, requested);
  const path = target.pathname;
  return (
    target.origin === new URL(requested).origin &&
    (path === '/sign-in' || path.startsWith('/sign-in/'))
  );
}

/**
 * The portal is either the signed-in shell or a redirect to the same site's sign-in page.
 * @param {Response} res
 * @param {string} url
 */
async function checkPortal(res, url) {
  if (res.status === 200) return checkHtml(res);
  await drain(res);
  if (!SIGN_IN_REDIRECTS.includes(res.status)) {
    return { ok: false, detail: `status ${res.status}, expected 200 or a redirect to /sign-in` };
  }
  const location = res.headers.get('location') ?? '';
  return isSignIn(location, url)
    ? { ok: true, detail: `${res.status} to ${location}` }
    : { ok: false, detail: `${res.status} to ${location || '(no location)'}, expected /sign-in` };
}

/**
 * Whether a page must carry `noindex`. The console is never indexable (spec 02 D28, robotsTagFor),
 * so `--expect-indexable` still expects it there.
 * @param {'noindex' | 'indexable'} mode
 * @param {string} name
 */
const wantsNoindex = (mode, name) => mode === 'noindex' || name === 'console';

/**
 * @param {SmokeOptions['robots']} mode
 * @param {{ name: string, tag: string | null | undefined }[]} pages `undefined` when unreachable
 * @returns {SmokeResult}
 */
function checkRobots(mode, pages) {
  if (mode === 'ignore') return { name: 'robots', ok: true, detail: 'not checked' };
  const wrong = pages.flatMap(({ name, tag }) => {
    if (tag === undefined) return [`${name} (no response)`];
    if (wantsNoindex(mode, name)) {
      return tag?.toLowerCase().includes('noindex')
        ? []
        : [`${name} (expected noindex, got ${tag ?? 'none'})`];
    }
    return tag === null ? [] : [`${name} (expected none, got ${tag})`];
  });
  const checked = pages.map(({ name }) => name).join(', ');
  return wrong.length === 0
    ? { name: 'robots', ok: true, detail: `x-robots-tag as expected on ${checked}` }
    : { name: 'robots', ok: false, detail: `x-robots-tag wrong on ${wrong.join(', ')}` };
}

/**
 * The Engine.IO WebSocket URL on the API's host.
 * @param {string} api
 */
export function socketUrl(api) {
  const url = new URL(api);
  const scheme = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${url.host}/socket.io/?EIO=4&transport=websocket`;
}

/**
 * Runs the checks in order. A check that cannot reach its host fails; it never throws.
 * @param {SmokeOptions} options
 * @param {SmokeDeps} deps
 * @returns {Promise<SmokeResult[]>}
 */
export async function runSmoke(options, deps) {
  /** @type {SmokeResult[]} */
  const results = [];
  /** @type {{ name: string, tag: string | null | undefined }[]} */
  const pages = [];

  /**
   * @param {string} name
   * @param {string} url
   * @param {(res: Response, url: string) => Promise<{ ok: boolean, detail: string }>} check
   */
  const page = async (name, url, check) => {
    /** @type {string | null | undefined} undefined until a response arrives */
    let tag;
    /** @type {{ ok: boolean, detail: string }} */
    let outcome;
    try {
      const res = await get(deps, options, url);
      tag = res.headers.get('x-robots-tag');
      outcome = await check(res, url);
    } catch (error) {
      outcome = { ok: false, detail: `GET ${url}: ${reason(error)}` };
    }
    // One entry per page, whether the request, the body or the check failed.
    pages.push({ name, tag });
    results.push({ name, ...outcome });
  };

  await page('ready', `${options.api}/api/v1/health/ready`, checkReady);
  await page('landing', `${options.web}/`, checkHtml);
  await page('portal', `${options.web}/app`, checkPortal);
  await page('console', `${options.console}/`, checkHtml);
  results.push(checkRobots(options.robots, pages));

  const ws = socketUrl(options.api);
  try {
    const first = await deps.openWebSocket(ws);
    const ok = first.startsWith('0{') && first.includes('"sid"');
    results.push({
      name: 'websocket',
      ok,
      detail: ok ? 'Engine.IO open packet' : `first message ${JSON.stringify(first.slice(0, 40))}`,
    });
  } catch (error) {
    results.push({ name: 'websocket', ok: false, detail: `${ws}: ${reason(error)}` });
  }

  if (options.origin !== undefined) {
    const url = `${options.origin}/api/v1/health/live`;
    try {
      const res = await get(deps, options, url);
      const body = await res.text();
      const refused = res.status === 403 && body === ALB_FORBIDDEN_BODY;
      results.push({
        name: 'origin-refused',
        ok: refused,
        detail: refused
          ? '403 Forbidden from the load balancer without the origin header'
          : `${res.status} ${JSON.stringify(body.slice(0, 40))} without the origin header, ` +
            `expected 403 ${JSON.stringify(ALB_FORBIDDEN_BODY)}`,
      });
    } catch (error) {
      results.push({ name: 'origin-refused', ok: false, detail: `GET ${url}: ${reason(error)}` });
    }
  }
  return results;
}

/**
 * Opens a WebSocket with Node's global `WebSocket` and resolves with its first text message.
 * @param {number} timeoutMs
 * @returns {(url: string) => Promise<string>}
 */
export function nodeWebSocket(timeoutMs) {
  return (url) =>
    new Promise((resolvePromise, reject) => {
      const socket = new WebSocket(url);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error(`no message within ${timeoutMs} ms`));
      }, timeoutMs);
      socket.addEventListener('message', (event) => {
        clearTimeout(timer);
        socket.close();
        resolvePromise(typeof event.data === 'string' ? event.data : '(binary message)');
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('could not connect'));
      });
      socket.addEventListener('close', (event) => {
        clearTimeout(timer);
        reject(new Error(`closed before a message (code ${event.code})`));
      });
    });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  /** @type {SmokeOptions} */
  let options;
  try {
    options = parseSmokeArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${reason(error)}\nUsage: node scripts/smoke.mjs --web <url> --console <url> [--api <url>] ` +
        '[--origin <url>] [--expect-noindex | --expect-indexable]\n',
    );
    process.exit(2);
  }
  const results = await runSmoke(options, {
    fetch: globalThis.fetch,
    openWebSocket: nodeWebSocket(options.timeoutMs),
  });
  for (const { name, ok, detail } of results) {
    process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(14)} ${detail}\n`);
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
