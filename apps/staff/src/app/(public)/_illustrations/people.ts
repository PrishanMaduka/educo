/*
 * The people in the landing page illustrations (spec 19): one shared painted figure (`wfig`) with
 * options for clothes and hair, Amaya's own figure in her school kit (front and back view), and
 * the kites that carry a tiny silhouette of someone in her circle. No outlined cartoon faces: a
 * rosy cheek and a hint of an eye.
 */
import { ell, ln, pth, sk, wv, type Pigment } from './paint';

/** Someone in Amaya's circle (the hero kites, the ticker and the diagram). */
export type CirclePerson =
  | 'jaya'
  | 'perera'
  | 'fernando'
  | 'herath'
  | 'dias'
  | 'silva'
  | 'sunethra'
  | 'dilhani'
  | 'ruwan'
  | 'kamala';

type KiteHair = 'long' | 'short' | 'cap' | 'bun' | 'grey';

const KITE_HAIR: Record<CirclePerson, KiteHair> = {
  jaya: 'long',
  perera: 'short',
  fernando: 'long',
  herath: 'cap',
  dias: 'bun',
  silva: 'long',
  sunethra: 'bun',
  dilhani: 'long',
  ruwan: 'short',
  kamala: 'grey',
};

/** A kite carrying a tiny silhouette of one person, with a tail of rose bows. */
export function wkite(
  who: CirclePerson,
  x: number,
  y: number,
  s: number,
  c: Pigment,
  rot = 0,
  tail = true,
): string {
  const hair = KITE_HAIR[who];
  const ink = `fill="${wv('charcoal')}"`;
  let sil = `<circle cx="0" cy="-7" r="5" ${ink} fill-opacity=".26"/><path d="M-9.5 9Q-9 -1 0 -1.2Q9 -1 9.5 9Z" ${ink} fill-opacity=".26"/>`;
  if (hair === 'long')
    sil += `<path d="M-5.4 -7Q-7 3 -4 6H4Q7 3 5.4 -7Z" ${ink} fill-opacity=".2"/>`;
  if (hair === 'bun') sil += `<circle cx="0" cy="-13.4" r="2.7" ${ink} fill-opacity=".26"/>`;
  if (hair === 'grey') {
    sil += `<circle cx="0" cy="-13.4" r="2.9" fill="${wv('white')}" fill-opacity=".95"/><path d="M-5 -9Q0 -14 5 -9" fill="none" stroke="${wv('white')}" stroke-width="2.2"/>`;
  }
  if (hair === 'cap')
    sil += `<path d="M-5.5 -9Q0 -16 5.5 -9L9.5 -8.5Z" ${ink} fill-opacity=".34"/>`;
  const tailMarks = tail
    ? ln('M0 40C-9 52 9 62 -2 74S7 94 0 108', 0.9, 0.4) +
      `<path d="M-3 58l-6 -3.4v6.8Z M-3 58l6 -3.4v6.8Z M1 86l-6 -3.4v6.8Z M1 86l6 -3.4v6.8Z" fill="${wv('rose')}" fill-opacity=".65"/>`
    : '';
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
    tailMarks +
    pth('M0 -36L25 -2L0 40L-25 -2Z', c, 0.52) +
    pth('M0 -36L25 -2L0 -2Z', 'white', 0.28) +
    pth('M-25 -2L0 40L0 -2Z', c, 0.18) +
    ln('M0 -36V40M-25 -2H25', 0.7, 0.32) +
    ln('M0 -36L25 -2L0 40L-25 -2Z', 0.6, 0.22) +
    `<path d="M0 40l-4 4h8Z" fill="${wv('rose')}" fill-opacity=".7"/><g transform="translate(0 6)">${sil}</g></g>`
  );
}

/** Amaya seen from behind: white uniform, plaits with ribbons, school bag, looking up at the sky. */
export function amayaBack(x: number, y: number, s: number): string {
  const skirt = 'M-16 -62L-27 -31Q-14 -27 0 -28Q14 -27 27 -31L16 -62Z';
  const bodice = 'M-15.5 -97Q0 -102 15.5 -97L17 -60H-17Z';
  const g = [
    ell(0, 2, 30, 6, 'charcoal', 0.22, 'wcMid'),
    pth('M-8.5 -32h6v22h-6Z M2.5 -32h6v22h-6Z', 'skin', 0.88, 'wcFig'),
    pth('M-9 -14h7v9.5h-7Z M2 -14h7v9.5h-7Z', 'uniform', 0.97, 'wcFig'),
    pth('M-9 -14h7v9.5h-7Z M2 -14h7v9.5h-7Z', 'sky', 0.26, 'wcFig'),
    pth(
      'M-10.6 -4.8h8.6q2.2 0 2.2 2.8v2.4h-10.8Z M1.8 -4.8h8.6q2.2 0 2.2 2.8v2.4h-10.8Z',
      'charcoal',
      0.9,
      'wcFig',
    ),
    sk('M-16 -92Q-24 -76 -22 -60', 'sky', 9.5, 0.3),
    sk('M-16 -92Q-24 -76 -22 -60', 'uniform', 8, 0.97),
    `<circle cx="-22" cy="-58" r="3.4" fill="${wv('skin')}" fill-opacity=".92"/>`,
    sk('M16 -92Q24 -80 20 -66', 'sky', 9.5, 0.3),
    sk('M16 -92Q24 -80 20 -66', 'uniform', 8, 0.97),
    `<circle cx="20" cy="-64" r="3.4" fill="${wv('skin')}" fill-opacity=".92"/>`,
    pth(skirt, 'uniform', 0.97, 'wcFig'),
    pth('M5 -62L16 -62L27 -31Q17 -27.5 9 -28Z', 'sky', 0.26, 'wcFig'),
    pth('M-16 -62L-27 -31Q-20 -28 -13 -28L-8 -62Z', 'apricot', 0.12, 'wcFig'),
    ln('M-9 -61L-14 -29M-3 -61.5L-4.5 -28M3 -61.5L4.5 -28M9 -61L14 -29', 0.7, 0.32),
    ln(skirt, 0.6, 0.36),
    pth(bodice, 'uniform', 0.97, 'wcFig'),
    pth('M5 -99Q13 -98.5 15.5 -97L17 -60H7Z', 'sky', 0.22, 'wcFig'),
    ln(bodice, 0.6, 0.36),
    pth('M-17 -66h34v5h-34Z', 'uniform', 0.97, 'wcFig'),
    pth('M-17 -66h34v5h-34Z', 'sky', 0.3, 'wcFig'),
    `<path d="M14 -98L-18 -58" fill="none" stroke="${wv('roof')}" stroke-opacity=".85" stroke-width="3.2" stroke-linecap="round" filter="url(#wcFig)"/>`,
    pth(
      'M-32 -62h16q2.4 0 2.4 2.4v15q0 2.4 -2.4 2.4h-16q-2.4 0 -2.4 -2.4v-15q0 -2.4 2.4 -2.4Z',
      'ochre',
      0.88,
      'wcFig',
    ),
    pth('M-32 -62h16q2.4 0 2.4 2.4v6h-20.8v-6q0 -2.4 2.4 -2.4Z', 'roof', 0.4, 'wcFig'),
    ln('M-34.4 -62h20.8v19.8h-20.8Z', 0.5, 0.35),
    pth('M-4.5 -106h9v9h-9Z', 'skin', 0.9, 'wcFig'),
    pth('M-10 -99Q0 -91 10 -99Q5 -102 0 -101.4Q-5 -102 -10 -99Z', 'uniform', 0.98, 'wcFig'),
    ln('M-10 -99Q0 -91 10 -99', 0.6, 0.45),
    `<circle cx="3.2" cy="-118" r="12.6" fill="${wv('skin')}" fill-opacity=".9" filter="url(#wcFig)"/>`,
    `<ellipse cx="13.6" cy="-114" rx="2.6" ry="3.6" fill="${wv('skin')}" fill-opacity=".95"/><ellipse cx="13.5" cy="-109.5" rx="2.8" ry="2.2" fill="${wv('rose')}" fill-opacity=".55"/>`,
    `<circle cx="-.5" cy="-119.5" r="13.4" fill="${wv('hair')}" fill-opacity=".94" filter="url(#wcFig)"/>`,
    ln('M-1 -132V-108', 0.7, 0.35, 'white'),
    ln('M-8 -126q4 6 2 14M7 -127q-3 6 -1 15', 0.5, 0.25, 'white'),
  ];
  for (const px of [-6.5, 6.5]) {
    g.push(
      `<g fill="${wv('hair')}" fill-opacity=".92" filter="url(#wcFig)"><ellipse cx="${px}" cy="-103" rx="3.6" ry="4.4"/><ellipse cx="${px * 1.05}" cy="-95.5" rx="3.3" ry="4.2"/><ellipse cx="${px * 1.1}" cy="-88.5" rx="3" ry="3.8"/><ellipse cx="${px * 1.13}" cy="-82" rx="2.7" ry="3.4"/></g>`,
      ln(
        `M${px - 2.4} -105l3.5 2M${px - 2.4} -97.6l3.5 2M${px - 2} -90.6l3.5 2`,
        0.5,
        0.4,
        'white',
      ),
      pth(`M${px * 1.13} -77l-6 -3.6v7.2Z M${px * 1.13} -77l6 -3.6v7.2Z`, 'rose', 0.92, 'wcFig'),
      ln(`M${px * 1.13 - 1} -76l-1.4 5.4M${px * 1.13 + 1} -76l1.4 5.4`, 1.1, 0.6, 'rose'),
    );
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">${g.join('')}</g>`;
}

/**
 * Amaya, front three-quarter view, in her school kit: a white frock with a collar and a pleated
 * skirt, the school tie, white socks and black shoes, plaits with rose ribbons and her ochre
 * satchel. Feet at 0, about 112 tall.
 */
export function wamaya(x: number, y: number, s: number): string {
  const W: Pigment = 'uniform';
  const shade = (d: string, op = 0.2) => pth(d, 'sky', op, 'wcFig');
  const warm = (d: string, op = 0.12) => pth(d, 'apricot', op, 'wcFig');
  const skirt = 'M-13 -52L-21 -26Q-11 -22 0 -23Q11 -22 21 -26L13 -52Z';
  const bodice = 'M-11.5 -79Q0 -83 11.5 -79L13 -52H-13Z';
  const socks = 'M-8.4 -13h6.4v9h-6.4Z M2 -13h6.4v9h-6.4Z';
  const g = [
    ell(0, 1.5, 22, 4, 'charcoal', 0.22, 'wcMid'),
    // legs, socks and shoes
    pth('M-8 -26h5.6v20h-5.6Z M2.4 -26h5.6v20h-5.6Z', 'skin', 0.9, 'wcFig'),
    pth('M-5 -26h2.6v20h-2.6Z M5.4 -26h2.6v20h-2.6Z', 'roof', 0.1, 'wcFig'),
    pth(socks, W, 0.97, 'wcFig'),
    shade(socks, 0.22),
    ln('M-8.4 -12h6.4M2 -12h6.4', 0.6, 0.35),
    pth(
      'M-10 -4.5h8q2.4 0 2.4 2.6v2.4h-10.4Z M1.6 -4.5h8q2.4 0 2.4 2.6v2.4h-10.4Z',
      'charcoal',
      0.92,
      'wcFig',
    ),
    `<path d="M-7 -3.4h3M4.6 -3.4h3" stroke="${wv('light')}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`,
    // pleated skirt with soft shade and fold lines
    pth(skirt, W, 0.97, 'wcFig'),
    shade('M4 -52L13 -52L21 -26Q12 -22.5 6 -23Z', 0.24),
    warm('M-13 -52L-21 -26Q-15 -23.5 -10 -23.5L-6 -52Z'),
    ln('M-7.5 -51L-11 -24M-2.5 -51.5L-3.5 -23M2.5 -51.5L3.5 -23M7.5 -51L11 -24', 0.6, 0.34),
    ln(skirt, 0.6, 0.4),
    // bodice, belt, puff sleeves and arms
    pth(bodice, W, 0.97, 'wcFig'),
    shade('M4 -81Q10 -80.5 11.5 -79L13 -52H5Z', 0.22),
    ln(bodice, 0.6, 0.38),
    pth('M-13 -56h26v4.4h-26Z', W, 0.97, 'wcFig'),
    shade('M-13 -56h26v4.4h-26Z', 0.3),
    ln('M-13 -56h26M-13 -51.6h26', 0.5, 0.38),
    `<ellipse cx="-13" cy="-76" rx="6" ry="5" fill="${wv(W)}" fill-opacity=".97" filter="url(#wcFig)"/><ellipse cx="13" cy="-76" rx="6" ry="5" fill="${wv(W)}" fill-opacity=".97" filter="url(#wcFig)"/>`,
    shade('M8 -79a6 5 0 0 1 11 3.5a6 5 0 0 1 -6 4.5Z', 0.28),
    ln('M-19 -75a6 5 0 0 1 12 -2M7 -77a6 5 0 0 1 12 2', 0.55, 0.35),
    sk('M-16 -72Q-19 -60 -17 -49', 'skin', 5, 0.92),
    `<circle cx="-17" cy="-48" r="2.7" fill="${wv('skin')}" fill-opacity=".95"/>`,
    sk('M16 -72Q19 -62 12 -57', 'skin', 5, 0.92),
    `<circle cx="11.4" cy="-57" r="2.7" fill="${wv('skin')}" fill-opacity=".95"/>`,
    // satchel: the strap from the right shoulder to the left hip, the bag with a flap and buckle
    `<path d="M10 -80L-14 -46" fill="none" stroke="${wv('roof')}" stroke-opacity=".8" stroke-width="2.6" stroke-linecap="round" filter="url(#wcFig)"/>`,
    pth('M-24 -50h14q2 0 2 2v12q0 2 -2 2h-14q-2 0 -2 -2v-12q0 -2 2 -2Z', 'ochre', 0.85, 'wcFig'),
    pth('M-24 -50h14q2 0 2 2v6h-18v-6q0 -2 2 -2Z', 'roof', 0.38, 'wcFig'),
    `<rect x="-18.6" y="-44.6" width="3.2" height="2.6" rx=".6" fill="${wv('white')}" fill-opacity=".9"/>`,
    ln('M-26 -50h18v16h-18Z', 0.5, 0.35),
    // neck, collar and the school tie
    pth('M-3.4 -88h6.8v8h-6.8Z', 'skin', 0.92, 'wcFig'),
    pth('M-8.5 -81Q-6 -74 0 -77Q6 -74 8.5 -81Q4 -83 0 -81Q-4 -83 -8.5 -81Z', W, 0.98, 'wcFig'),
    ln('M-8.5 -81Q-6 -74 0 -77Q6 -74 8.5 -81', 0.6, 0.45),
    pth('M-2.2 -79.5h4.4l.8 3h-6Z', 'roof', 0.95, 'wcFig'),
    pth('M-2.1 -76.5L-3 -64.5L0 -61.2L3 -64.5L2.1 -76.5Z', 'roof', 0.9, 'wcFig'),
    pth('M.4 -76.5L3 -64.5L0 -61.2Z', 'charcoal', 0.14, 'wcFig'),
    // head: neat hair with a centre parting, face in three-quarter view, rosy cheek
    `<circle cx="-.5" cy="-96" r="11.2" fill="${wv('hair')}" fill-opacity=".95" filter="url(#wcFig)"/>`,
    `<circle cx="1.6" cy="-94" r="9.6" fill="${wv('skin')}" fill-opacity=".95" filter="url(#wcFig)"/>`,
    `<path d="M-10 -96Q-9 -106 0 -107Q10 -106 11 -97Q7 -103 1 -102.6L0 -100Q-5 -103 -10 -96Z" fill="${wv('hair')}" fill-opacity=".95"/>`,
    `<path d="M0 -106.6L.6 -100.6" stroke="${wv('white')}" stroke-width=".7" opacity=".55"/>`,
    `<ellipse cx="6.6" cy="-90.4" rx="2.4" ry="1.8" fill="${wv('rose')}" fill-opacity=".6"/><ellipse cx="-3" cy="-90.6" rx="1.9" ry="1.5" fill="${wv('rose')}" fill-opacity=".45"/>`,
    `<path d="M3.6 -95.2q1 -.8 2 0M-2.6 -95.2q1 -.8 2 0" fill="none" stroke="${wv('charcoal')}" stroke-width=".8" stroke-linecap="round" opacity=".7"/><path d="M.8 -89.2q1.4 1 2.8 0" fill="none" stroke="${wv('roof')}" stroke-width=".8" stroke-linecap="round" opacity=".6"/>`,
  ];
  // plaits over the shoulders, tied with rose ribbon bows
  for (const [px, d] of [
    [-11.4, -1],
    [12, 1],
  ] as const) {
    const end = px + d * 1.2;
    g.push(
      `<g fill="${wv('hair')}" fill-opacity=".95" filter="url(#wcFig)"><ellipse cx="${px}" cy="-89" rx="3.2" ry="3.8"/><ellipse cx="${px + d * 0.6}" cy="-82.4" rx="3" ry="3.6"/><ellipse cx="${px + d * 1}" cy="-76.2" rx="2.8" ry="3.4"/><ellipse cx="${end}" cy="-70.4" rx="2.5" ry="3"/></g>`,
      ln(`M${px - 2} -91l3 2M${px - 2} -84.4l3 2M${px - 1.6} -78.2l3 2`, 0.5, 0.4, 'white'),
      pth(`M${end} -66.2l-5.4 -3.2l.4 6.4Z M${end} -66.2l5.4 -3.2l-.4 6.4Z`, 'rose', 0.95, 'wcFig'),
      `<circle cx="${end}" cy="-66.2" r="1.3" fill="${wv('roof')}" fill-opacity=".8"/>`,
      ln(`M${end - 1} -65.4l-1.4 5.4M${end + 1} -65.4l1.4 5.4`, 1.1, 0.6, 'rose'),
    );
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">${g.join('')}</g>`;
}

/** Options for the shared figure. `d` is the facing direction (1 right, -1 left). */
export interface FigureOptions {
  d?: 1 | -1;
  dress?: Pigment;
  top?: Pigment;
  pants?: Pigment;
  drape?: Pigment;
  tie?: Pigment;
  hair?: 'long';
  grey?: boolean;
  bun?: boolean;
  glasses?: boolean;
  plaits?: boolean;
  kid?: boolean;
  shorts?: boolean;
  trousers?: boolean;
  wave?: boolean;
  phone?: boolean;
  /** Markup held in the hand, drawn around the hand. */
  hold?: string;
}

const SHOES = 'M-10 -4.5h8q2.4 0 2.4 2.6v2.4h-10.4Z M1.6 -4.5h8q2.4 0 2.4 2.6v2.4h-10.4Z';
const KID_SOCKS = 'M-8.4 -12h6.4v8h-6.4Z M2 -12h6.4v8h-6.4Z';

/** A small painted figure in three-quarter view (feet at 0, about 100 tall). */
export function wfig(x: number, y: number, s: number, o: FigureOptions): string {
  const d = o.d ?? 1;
  const c = o.dress ?? 'rose';
  const top = o.top ?? c;
  const hairColour: Pigment = o.grey ? 'white' : 'hair';
  const g = [ell(0, 1, 19, 3.6, 'charcoal', 0.2, 'wcMid')];
  if (o.hair === 'long') {
    g.push(
      pth(`M${-9 * d} -92Q${-13 * d} -74 ${-7 * d} -64L${-1 * d} -70Z`, 'hair', 0.85, 'wcFig'),
    );
  }
  if (o.shorts) {
    g.push(
      pth('M-8 -26h5.6v20h-5.6Z M2.4 -26h5.6v20h-5.6Z', 'skin', 0.88, 'wcFig'),
      pth(KID_SOCKS, 'uniform', 0.95, 'wcFig'),
      pth(KID_SOCKS, 'sky', 0.24, 'wcFig'),
      pth(SHOES, 'charcoal', 0.9, 'wcFig'),
      pth('M-11 -49h22l1 23h-10l-1 -8l-1 8h-10Z', o.pants ?? 'sky', 0.75, 'wcFig'),
    );
  } else if (o.trousers) {
    g.push(pth('M-9 -47h8v45h-8Z M1 -47h8v45h-8Z', o.pants ?? 'charcoal', 0.7, 'wcFig'));
  } else {
    if (o.kid) {
      g.push(
        pth('M-8 -24h5.6v18h-5.6Z M2.4 -24h5.6v18h-5.6Z', 'skin', 0.88, 'wcFig'),
        pth(KID_SOCKS, 'uniform', 0.95, 'wcFig'),
        pth(SHOES, 'charcoal', 0.9, 'wcFig'),
      );
    }
    g.push(
      pth(
        o.kid ? 'M-13 -49L-19 -24Q0 -20 19 -24L13 -49Z' : 'M-13 -49L-16 -2Q0 2 16 -2L13 -49Z',
        c,
        0.8,
        'wcFig',
      ),
    );
  }
  g.push(sk(`M${-10 * d} -72Q${-13 * d} -58 ${-11 * d} -47`, top, 5.5, 0.65));
  g.push(pth('M-11 -75Q0 -79 11 -75L13 -45H-13Z', top, 0.85, 'wcFig'));
  if (top === 'uniform') {
    const isDressed = !o.shorts && !o.trousers;
    if (o.kid && isDressed)
      g.push(pth('M-13 -49L-19 -24Q0 -20 19 -24L13 -49Z', 'sky', 0.22, 'wcFig'));
    if (!o.kid && isDressed) g.push(pth('M-13 -49L-16 -2Q0 2 16 -2L13 -49Z', 'sky', 0.22, 'wcFig'));
    g.push(
      pth('M-11 -75Q0 -79 11 -75L13 -45H-13Z', 'sky', 0.18, 'wcFig'),
      ln('M-11 -75Q0 -79 11 -75L13 -45H-13Z', 0.6, 0.35),
    );
  }
  if (o.tie) {
    g.push(
      pth('M-1.8 -74L-2.6 -61L0 -58L2.6 -61L1.8 -74Z', o.tie, 0.9, 'wcFig'),
      pth('M-7 -76Q-4 -70 0 -73Q4 -70 7 -76Q3 -78 0 -77Q-3 -78 -7 -76Z', 'uniform', 0.98, 'wcFig'),
    );
  }
  if (o.drape) {
    g.push(
      pth(`M${-10 * d} -75L${13 * d} -38L${7 * d} -36L${-13 * d} -67Z`, o.drape, 0.7, 'wcFig'),
    );
  }
  const [ax, ay] = o.wave ? [17 * d, -99] : [12 * d, -46];
  g.push(
    sk(
      o.wave
        ? `M${10 * d} -73Q${21 * d} -83 ${ax} ${ay}`
        : `M${10 * d} -73Q${15 * d} -58 ${ax} ${ay}`,
      top,
      5.5,
      0.85,
    ),
    `<circle cx="${ax}" cy="${ay}" r="2.8" fill="${wv('skin')}" fill-opacity=".9"/>`,
    pth('M-3 -84h6v9h-6Z', 'skin', 0.9, 'wcFig'),
    `<circle cx="${-2 * d}" cy="-90" r="8.6" fill="${wv(hairColour)}" fill-opacity=".92" filter="url(#wcFig)"/>`,
  );
  if (o.bun) {
    g.push(
      `<circle cx="${-9.5 * d}" cy="-92" r="3.8" fill="${wv(hairColour)}" fill-opacity=".92"/>`,
    );
  }
  g.push(
    `<circle cx="${2.6 * d}" cy="-87.6" r="7.6" fill="${wv('skin')}" fill-opacity=".92" filter="url(#wcFig)"/>`,
    `<path d="M${-6 * d} -93Q${1 * d} -99 ${9 * d} -92" fill="none" stroke="${wv(hairColour)}" stroke-opacity=".9" stroke-width="3.4" stroke-linecap="round"/>`,
    `<ellipse cx="${6.2 * d}" cy="-84.6" rx="2.3" ry="1.8" fill="${wv('rose')}" fill-opacity=".6"/><path d="M${5 * d} -89.4h${1.8 * d}" stroke="${wv('charcoal')}" stroke-width="1" stroke-linecap="round" opacity=".6"/>`,
  );
  if (o.glasses) {
    g.push(
      `<circle cx="${6 * d}" cy="-89" r="2.6" fill="none" stroke="${wv('charcoal')}" stroke-width=".7" opacity=".6"/>`,
    );
  }
  if (o.plaits) {
    for (const px of [-7, 7]) {
      g.push(
        `<g fill="${wv('hair')}" fill-opacity=".92"><ellipse cx="${px}" cy="-80" rx="3" ry="3.6"/><ellipse cx="${px * 1.05}" cy="-73.5" rx="2.8" ry="3.4"/><ellipse cx="${px * 1.08}" cy="-67.5" rx="2.5" ry="3"/></g><path d="M${px * 1.08} -63l-4.5 -3v6Z M${px * 1.08} -63l4.5 -3v6Z" fill="${wv('rose')}" fill-opacity=".9"/>`,
      );
    }
  }
  if (o.phone) {
    g.push(
      `<rect x="${ax - 3.4}" y="${ay - 9}" width="6.8" height="10.5" rx="1.4" fill="${wv('charcoal')}" fill-opacity=".85"/>`,
    );
  }
  if (o.hold !== undefined) g.push(`<g transform="translate(${ax} ${ay - 4})">${o.hold}</g>`);
  return `<g transform="translate(${x} ${y}) scale(${s})">${g.join('')}</g>`;
}

/** Amaya as a small figure in a crowd (the shared figure in her school kit). */
export const AMAYA_KID: FigureOptions = {
  kid: true,
  dress: 'uniform',
  top: 'uniform',
  plaits: true,
  tie: 'roof',
};
/** A boy in school uniform. */
export const BOY: FigureOptions = { kid: true, top: 'uniform', shorts: true, tie: 'roof' };
/** Ms. Jayasinghe, Amaya's class teacher, in a lilac sari. */
export const JAYA: FigureOptions = { dress: 'lilac', drape: 'ochre', hair: 'long' };
