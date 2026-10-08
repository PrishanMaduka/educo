/* The hero scene: Amaya on the path between school and home; her circle drifts around her as kites. */
import {
  bob,
  ell,
  grass,
  moon,
  pth,
  teaRows,
  vbirds,
  wscene,
  wstars,
  wv,
  type Pigment,
  type Point,
} from './paint';
import { amayaBack, wkite, type CirclePerson } from './people';
import { whome, wpalm, wpoya, wschool, wstupa } from './places';

export const HERO_VIEWBOX = { width: 800, height: 860 } as const;

interface Kite {
  who: CirclePerson;
  at: Point;
  scale: number;
  colour: Pigment;
  rotate: number;
}

/** The eight kites: at school Ms. Jayasinghe, Mr. Perera, Coach Herath, Nurse Dias and Sunethra; at home Dilhani, Ruwan and Kamala. */
export const KITES: readonly Kite[] = [
  { who: 'jaya', at: [132, 300], scale: 1.45, colour: 'lilac', rotate: -10 },
  { who: 'perera', at: [250, 130], scale: 1.1, colour: 'sky', rotate: 6 },
  { who: 'herath', at: [430, 92], scale: 1.25, colour: 'apricot', rotate: -4 },
  { who: 'dias', at: [610, 150], scale: 1.05, colour: 'teal', rotate: 12 },
  { who: 'sunethra', at: [700, 330], scale: 0.95, colour: 'ochre', rotate: -6 },
  { who: 'dilhani', at: [560, 420], scale: 1.35, colour: 'rose', rotate: 8 },
  { who: 'ruwan', at: [400, 300], scale: 1.05, colour: 'sea', rotate: -8 },
  { who: 'kamala', at: [80, 490], scale: 0.95, colour: 'peach', rotate: 4 },
];

/** Where the glints pass on their way from one kite to another: just above Amaya. */
export const AMAYA_AT: Point = [270, 620];

/** Each kite's centre, for the travelling glints. */
export const KITE_AT: Readonly<Partial<Record<CirclePerson, Point>>> = Object.fromEntries(
  KITES.map((kite) => [kite.who, kite.at]),
);

const KITE_COLOUR: Readonly<Partial<Record<CirclePerson, Pigment>>> = Object.fromEntries(
  KITES.map((kite) => [kite.who, kite.colour]),
);

/** One person's kite on its own, for the ticker (view box -30 -40 60 84). */
export function kiteIcon(who: CirclePerson): string {
  return wkite(who, 0, 0, 1, KITE_COLOUR[who] ?? 'lilac', 0, false);
}

export function heroScene(): string {
  const [ax, ay] = AMAYA_AT;
  const s = [
    `<defs><linearGradient id="hSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wv('peach')}" stop-opacity=".6"/><stop offset=".45" stop-color="${wv('apricot')}" stop-opacity=".42"/><stop offset=".72" stop-color="${wv('paper')}" stop-opacity="0"/></linearGradient></defs><rect width="800" height="860" fill="url(#hSky)"/>`,
    ell(400, 180, 520, 240, 'peach', 0.16, 'wcSky'),
    ell(320, 400, 320, 110, 'apricot', 0.18, 'wcSky'),
    ell(700, 90, 180, 100, 'lilac', 0.14, 'wcSky'),
    moon(728, 66, 20),
    wstars([
      [80, 70],
      [250, 52],
      [420, 34],
      [560, 64],
      [750, 50],
      [730, 250],
      [60, 230],
      [360, 220, 1.2],
    ]),
    pth('M0 612Q140 586 260 598T520 590T800 600V660H0Z', 'lilac', 0.22, 'wcBig'),
    wstupa(470, 604, 0.55),
    pth('M300 700Q430 606 580 606T800 618V700Z', 'teal', 0.34, 'wcBig'),
    teaRows(380, 700, 420, 70),
    pth('M0 640Q100 612 220 624T500 700H0Z', 'olive', 0.3, 'wcBig'),
    wschool(560, 640, 0.62),
    whome(726, 656, 0.66),
    wpoya(682, 654, 0.55),
    wpalm(770, 668, 0.5, -1),
    wpalm(612, 646, 0.42, -1),
    pth(
      'M372 860C430 800 470 760 520 724S590 676 600 660L612 662C604 690 560 720 540 760S500 830 520 860Z',
      'ochre',
      0.36,
      'wcBig',
    ),
    pth('M0 694Q200 650 360 676T800 700V860H0Z', 'olive', 0.42, 'wcBig'),
    ell(140, 820, 260, 70, 'teal', 0.16),
    ell(640, 800, 240, 60, 'ochre', 0.1),
    grass(10, 470, 690, 850, 120, 0.5),
    grass(600, 790, 744, 850, 50, 0.45),
    vbirds(560, 560, 0.8, 0.45),
    vbirds(120, 520, 0.6, 0.35),
    // faint threads from each kite down towards Amaya
    KITES.map(
      ({ at: [x, y], scale }) =>
        `<path d="M${x} ${y + 40 * scale}Q${(x + ax) / 2} ${Math.max(y + 60, 420)} ${ax} ${ay - 10}" fill="none" stroke="${wv('charcoal')}" stroke-width=".8" stroke-dasharray="2 6" opacity=".22"/>`,
    ).join(''),
    KITES.map(({ who, at: [x, y], scale, colour, rotate }, i) =>
      bob(wkite(who, x, y, scale, colour, rotate), (i % 3) as 0 | 1 | 2),
    ).join(''),
    amayaBack(268, 836, 1.75),
  ];
  return wscene('mHero', 800, 860, s.join(''), 26);
}
