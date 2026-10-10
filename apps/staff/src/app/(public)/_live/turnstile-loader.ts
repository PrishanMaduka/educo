/*
 * Cloudflare Turnstile's browser script, loaded only when a visitor reaches the demo form (D57),
 * never at first paint. The types are the parts of Cloudflare's explicit-render API the form uses.
 */

/** The options `turnstile.render` takes (Cloudflare's names, hence the kebab-case keys). */
export interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  /** Invisible unless Cloudflare needs the visitor to do something. */
  appearance: 'interaction-only';
  theme: 'light' | 'dark' | 'auto';
  /** Off: the token comes through `callback`, so no hidden input joins the form's values. */
  'response-field': boolean;
  /** `auto`: Cloudflare renews an expired token by itself (the default, set so it stays so). */
  'refresh-expired': 'auto' | 'manual' | 'never';
  callback: (token: string) => void;
  'error-callback': (code: string) => void;
  'expired-callback': () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    /** Cloudflare calls it (the script's `onload` parameter) once `turnstile` is ready. */
    quadTurnstileReady?: () => void;
  }
}

const READY = 'quadTurnstileReady';
const SCRIPT_URL = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${READY}`;

let pending: { promise: Promise<TurnstileApi>; script: HTMLScriptElement } | null = null;

/**
 * Loads Turnstile's script once and answers with `window.turnstile`. A script that cannot load
 * (offline, blocked) rejects, is removed, and the next call tries again.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending?.script.isConnected) return pending.promise;
  const script = document.createElement('script');
  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    script.src = SCRIPT_URL;
    script.async = true;
    window[READY] = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile’s script loaded without its API.'));
    };
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('Turnstile’s script could not load.'));
    });
  });
  pending = { promise, script };
  document.head.append(script);
  return promise;
}
