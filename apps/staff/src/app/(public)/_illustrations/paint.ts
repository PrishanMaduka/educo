/*
 * Watercolour primitives for the landing page illustrations (spec 19). Each helper returns SVG
 * markup as a string; the scene components render it on the server, so no illustration code runs in
 * the browser. Colours come only from the `wc-*` pigment tokens (`var(--quad-wc-…)`), which switch
 * to the dusk versions in dark mode. The filters (`wcBig`, `wcMid`, …) are defined once on the page
 * by `WatercolourFilters`.
 */

/** A pigment from the tokens, for example `pigment('ochre')`. */
export type Pigment =
  | 'paper'
  | 'peach'
  | 'apricot'
  | 'sky'
  | 'lilac'
  | 'teal'
  | 'sea'
  | 'ochre'
  | 'olive'
  | 'charcoal'
  | 'rose'
  | 'roof'
  | 'white'
  | 'window'
  | 'skin'
  | 'hair'
  | 'uniform'
  | 'moonlight'
  | 'glint'
  | 'glint-core'
  | 'light'
  | 'shade';

export type Filter =
  | 'wcBig'
  | 'wcSky'
  | 'wcMid'
  | 'wcFig'
  | 'wcInk'
  | 'wcBloom'
  | 'wcFeather'
  | 'wcFeatherS'
  | 'wcPaper';

export type Point = readonly [x: number, y: number];

export const wv = (name: Pigment): string => `var(--quad-wc-${name})`;

/** A colour token that is not a pigment (text and accents shared with the page). */
export const token = (name: string): string => `var(--quad-${name})`;

/** Escapes text placed inside SVG markup. */
export function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

/** Washes multiply in light mode so they build up pigment (spec 19); `wc-blend` reads the token. */
const BLEND = ' class="wc-blend"';

/** A painted shape. White and uniform shapes cover what is behind them, so they never multiply. */
export function pth(d: string, c: Pigment, op = 0.55, f: Filter = 'wcMid'): string {
  const blend = f === 'wcFig' || c === 'white' || c === 'uniform' ? '' : BLEND;
  return `<path d="${d}" fill="${wv(c)}" fill-opacity="${op}" filter="url(#${f})"${blend}/>`;
}

/** A soft round wash. */
export function ell(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: Pigment,
  op = 0.5,
  f: Filter = 'wcBig',
): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${wv(c)}" fill-opacity="${op}" filter="url(#${f})"${BLEND}/>`;
}

/** A fine ink line. `dash` draws it dotted, for threads and paths. */
export function ln(d: string, w = 1.2, op = 0.6, c: Pigment = 'charcoal', dash?: string): string {
  const dasharray = dash === undefined ? '' : ` stroke-dasharray="${dash}"`;
  return `<path d="${d}" fill="none" stroke="${wv(c)}" stroke-width="${w}"${dasharray} stroke-linecap="round" stroke-linejoin="round" opacity="${op}" filter="url(#wcInk)"/>`;
}

/** A thick painted stroke (arms, the gate arch). */
export function sk(d: string, c: Pigment, w: number, op = 0.85): string {
  return `<path d="${d}" fill="none" stroke="${wv(c)}" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" filter="url(#wcFig)"/>`;
}

/** A seeded random sequence, so the dry-brush grass is the same on every render. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** Dry-brush grass blades scattered over a box. */
export function grass(x0: number, x1: number, y0: number, y1: number, n: number, op = 0.5): string {
  const rnd = seeded(97 + x0);
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const h = 4 + rnd() * 9;
    const b = (rnd() - 0.5) * 7;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}q${(b / 2).toFixed(1)} ${(-h / 2).toFixed(1)} ${b.toFixed(1)} ${(-h).toFixed(1)}`;
  }
  return ln(d, 0.8, op, 'olive');
}

/** Three small birds. */
export function vbirds(x: number, y: number, s = 1, op = 0.55): string {
  return ln(
    `M${x} ${y}q${4 * s} ${-4 * s} ${8 * s} 0q${4 * s} ${-4 * s} ${8 * s} 0` +
      `M${x + 22 * s} ${y - 10 * s}q${3 * s} ${-3 * s} ${6 * s} 0q${3 * s} ${-3 * s} ${6 * s} 0` +
      `M${x + 8 * s} ${y - 22 * s}q${2.5 * s} ${-2.5 * s} ${5 * s} 0q${2.5 * s} ${-2.5 * s} ${5 * s} 0`,
    1,
    op,
  );
}

/** Dotted rows of tea bushes across a hillside. */
export function teaRows(x: number, y: number, w: number, h: number, n = 5): string {
  let d = '';
  for (let k = 1; k <= n; k += 1) {
    const yy = y - (h * k) / (n + 1);
    d += `M${x + w * 0.06 * k} ${yy + h * 0.12}Q${x + w / 2} ${yy - h * 0.22} ${x + w - w * 0.06 * k} ${yy + h * 0.12}`;
  }
  return `<path d="${d}" fill="none" stroke="${wv('olive')}" stroke-width="2.2" stroke-dasharray="1.5 5" stroke-linecap="round" opacity=".45" filter="url(#wcInk)"/>`;
}

/**
 * A scene on paper: the painting, paper grain over it, and a painted vignette that fades it into
 * the page. `small` uses the tighter vignette for the small scenes.
 */
export function wscene(
  id: string,
  w: number,
  h: number,
  inner: string,
  pad: number,
  small = false,
): string {
  const feather = small ? 'wcFeatherS' : 'wcFeather';
  return (
    `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="${pad * 3}" fill="${wv('light')}" filter="url(#${feather})"/></mask></defs>` +
    `<g mask="url(#${id})"><g class="isolate"><rect width="${w}" height="${h}" fill="${wv('paper')}"/>${inner}${paperGrain(w, h, 0.3)}</g></g>`
  );
}

/** Fine paper grain, multiplied over a painting. */
export function paperGrain(w: number, h: number, op: number): string {
  return `<rect width="${w}" height="${h}" fill="${wv('shade')}" filter="url(#wcPaper)" class="mix-blend-multiply" opacity="${op}"/>`;
}

/** The moon, shown only in the dusk (dark) version of a scene. */
export function moon(x: number, y: number, r: number): string {
  return `<g class="opacity-0 dark:opacity-100"><circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="${wv('moonlight')}" opacity=".16" filter="url(#wcBloom)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${wv('moonlight')}" opacity=".9" filter="url(#wcMid)"/></g>`;
}

/** Stars, shown only at dusk. */
export function wstars(points: readonly (readonly [number, number, number?])[]): string {
  const stars = points
    .map(
      ([a, b, r = 1.5]) =>
        `<circle cx="${a}" cy="${b}" r="${r}" fill="${wv('light')}" opacity=".75"/>`,
    )
    .join('');
  return `<g class="opacity-0 dark:opacity-100">${stars}</g>`;
}

/** A painted heart. */
export function heartP(x: number, y: number, s: number, c: Pigment = 'rose'): string {
  return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -3C0 -9 -9 -10 -9 -3.5C-9 2 0 8 0 8S9 2 9 -3.5C9 -10 0 -9 0 -3Z" fill="${wv(c)}" fill-opacity=".9" filter="url(#wcFig)"/>`;
}

/** A four-pointed sparkle. */
export function star4(x: number, y: number, r: number, c: Pigment = 'ochre'): string {
  return `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${wv(c)}" fill-opacity=".85"/>`;
}

/** A white tick on a painted disc. */
export function tick(x: number, y: number, r: number, d: string, w = 2.2): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${wv('teal')}" fill-opacity=".85" filter="url(#wcFig)"/><path d="${d}" fill="none" stroke="${wv('light')}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Gentle bobbing (off with reduced motion). `delay` staggers neighbours, as in the prototype. */
export function bob(inner: string, delay: 0 | 1 | 2 = 0): string {
  const stagger = ['', ' [animation-delay:-1.6s]', ' [animation-delay:-3.1s]'][delay] ?? '';
  return `<g class="motion-safe:animate-bob${stagger}">${inner}</g>`;
}

/** SVG text in the page font. `classes` are Tailwind utilities (size, weight, fill). */
export function text(x: number, y: number, content: string, classes: string, extra = ''): string {
  return `<text x="${x}" y="${y}" class="font-sans ${classes}"${extra}>${esc(content)}</text>`;
}
