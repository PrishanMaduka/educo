/* What is the Quad Circle: the circle diagram (who), four small scenes (how), four rule icons (what keeps it safe). */
import {
  ell,
  esc,
  heartP,
  ln,
  paperGrain,
  pth,
  tick,
  token,
  wscene,
  wv,
  type Point,
} from './paint';
import { wamaya, wfig, type FigureOptions } from './people';
import { groundS, mural, whome } from './places';

import { t } from '@/i18n';

type DiagramPerson = {
  key:
    'jaya' | 'perera' | 'herath' | 'dias' | 'silva' | 'sunethra' | 'dilhani' | 'ruwan' | 'kamala';
  deg: number;
  look: FigureOptions;
};

const SCHOOL: readonly DiagramPerson[] = [
  { key: 'jaya', deg: -90, look: { dress: 'lilac', drape: 'ochre', hair: 'long' } },
  { key: 'perera', deg: -30, look: { top: 'sky', trousers: true } },
  { key: 'herath', deg: 30, look: { top: 'roof', trousers: true } },
  { key: 'dias', deg: 90, look: { dress: 'teal', bun: true } },
  { key: 'silva', deg: 150, look: { dress: 'ochre', drape: 'lilac', hair: 'long' } },
  { key: 'sunethra', deg: 210, look: { dress: 'rose', drape: 'ochre', bun: true } },
];

const HOME: readonly DiagramPerson[] = [
  { key: 'dilhani', deg: 0, look: { dress: 'rose', hair: 'long' } },
  { key: 'ruwan', deg: 120, look: { top: 'sea', trousers: true } },
  {
    key: 'kamala',
    deg: 224,
    look: { dress: 'ochre', drape: 'roof', grey: true, bun: true, glasses: true },
  },
];

const label = (key: DiagramPerson['key'], part: 'name' | 'role'): string =>
  t(`public.circle.diagram.${key}.${part}` as const);

/** A name and role on a painted paper patch. The role hides below 620 px (spec 19). */
function dLabel(x: number, y: number, name: string, role: string): string {
  const rx = Math.max(name.length, role.length) * 4.9 + 10;
  return (
    `<ellipse cx="${x}" cy="${y + 8}" rx="${rx}" ry="22" fill="${wv('paper')}" fill-opacity=".82" filter="url(#wcMid)"/>` +
    `<text x="${x}" y="${y + 4}" text-anchor="middle" class="fill-ink font-sans text-[19px] font-extrabold">${esc(name)}</text>` +
    `<text x="${x}" y="${y + 22}" text-anchor="middle" class="fill-ink-2 font-sans text-[15px] font-semibold max-[620px]:hidden">${esc(role)}</text>`
  );
}

function arrowPaint(d: string, head: string, colour: string): string {
  return (
    `<path d="${d}" fill="none" stroke="${colour}" stroke-opacity=".3" stroke-width="16" stroke-linecap="round" filter="url(#wcMid)"/>` +
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="3.2" stroke-linecap="round" opacity=".9" filter="url(#wcInk)"/>` +
    `<path d="${head}" fill="${colour}" fill-opacity=".95" filter="url(#wcFig)"/>`
  );
}

/** The teal of "thanks & tries": teal deepened towards the ink so it reads on paper. */
const FLOW_TEAL = `color-mix(in srgb,${token('c5')} 55%,${token('ink')})`;
const HOME_RING = `color-mix(in srgb,${token('c4')} 45%,${token('ink')})`;

export function circleDiagram(): string {
  const RO = 244;
  const RI = 140;
  const CY = 336;
  const at = (r: number, deg: number): Point => [
    320 + r * Math.cos((deg * Math.PI) / 180),
    CY + r * Math.sin((deg * Math.PI) / 180),
  ];
  const xy = (p: Point) => `${p[0]} ${p[1]}`;
  const painted = [
    ell(320, CY, 300, 300, 'apricot', 0.14),
    ell(230, 220, 180, 140, 'peach', 0.14),
    ell(430, 470, 200, 140, 'lilac', 0.12),
    `<circle cx="320" cy="${CY}" r="${RO}" fill="none" stroke="${wv('sky')}" stroke-opacity=".32" stroke-width="30" filter="url(#wcMid)" class="wc-blend"/><circle cx="320" cy="${CY}" r="${RO}" fill="none" stroke="${wv('sky')}" stroke-width="1.2" stroke-dasharray="3 7" opacity=".7"/>`,
    `<circle cx="320" cy="${CY}" r="${RI}" fill="none" stroke="${wv('apricot')}" stroke-opacity=".5" stroke-width="28" filter="url(#wcMid)" class="wc-blend"/><circle cx="320" cy="${CY}" r="${RI}" fill="none" stroke="${wv('ochre')}" stroke-width="1.2" stroke-dasharray="3 7" opacity=".7"/>`,
    ell(320, CY - 6, 78, 84, 'rose', 0.2, 'wcMid'),
  ];
  const ring = 'font-sans text-[15px] font-black tracking-[.2em]';
  const over = [
    `<defs><path id="dArcS" d="M${xy(at(RO + 30, -112))}A${RO + 30} ${RO + 30} 0 0 1 ${xy(at(RO + 30, -8))}"/><path id="dArcH" d="M${xy(at(RI - 26, -104))}A${RI - 26} ${RI - 26} 0 0 1 ${xy(at(RI - 26, -16))}"/></defs>`,
    `<text class="${ring} fill-ink-2"><textPath href="#dArcS" startOffset="50%" text-anchor="middle">${esc(t('public.circle.diagram.ringSchool'))}</textPath></text>`,
    `<text class="${ring}" fill="${HOME_RING}"><textPath href="#dArcH" startOffset="50%" text-anchor="middle">${esc(t('public.circle.diagram.ringHome'))}</textPath></text>`,
  ];
  // What flows: moments and learning go home; thanks and tries come back to school.
  const [a1, a2] = [at(226, 60), at(160, 60)];
  const [b1, b2] = [at(160, 180), at(226, 180)];
  over.push(
    arrowPaint(
      `M${xy(a1)}Q${(a1[0] + a2[0]) / 2 + 10} ${(a1[1] + a2[1]) / 2 + 6} ${xy(a2)}`,
      `M${a2[0] - 11} ${a2[1] + 4}L${a2[0] - 2} ${a2[1] - 16}L${a2[0] + 12} ${a2[1] - 2}Z`,
      token('coral-ink'),
    ),
    arrowPaint(
      `M${xy(b1)}Q${(b1[0] + b2[0]) / 2} ${b1[1] - 12} ${xy(b2)}`,
      `M${b2[0] + 2} ${b2[1] - 12}L${b2[0] - 16} ${b2[1]}L${b2[0] + 2} ${b2[1] + 12}Z`,
      FLOW_TEAL,
    ),
  );
  const flow = 'font-sans text-base font-extrabold';
  const ta = at(206, 76);
  const tb = at(198, 170);
  over.push(
    `<text x="${ta[0] + 10}" y="${ta[1] - 4}" text-anchor="middle" class="${flow} fill-coral-ink">${esc(t('public.circle.diagram.outLine1'))}</text>`,
    `<text x="${ta[0] + 10}" y="${ta[1] + 14}" text-anchor="middle" class="${flow} fill-coral-ink">${esc(t('public.circle.diagram.outLine2'))}</text>`,
    `<text x="${tb[0]}" y="${tb[1] - 6}" text-anchor="middle" class="${flow}" fill="${FLOW_TEAL}">${esc(t('public.circle.diagram.backLine1'))}</text>`,
    `<text x="${tb[0]}" y="${tb[1] + 12}" text-anchor="middle" class="${flow}" fill="${FLOW_TEAL}">${esc(t('public.circle.diagram.backLine2'))}</text>`,
  );
  for (const [people, radius, scale] of [
    [SCHOOL, RO, 0.7],
    [HOME, RI, 0.72],
  ] as const) {
    for (const { key, deg, look } of people) {
      const [x, y] = at(radius, deg);
      over.push(
        wfig(x, y + 30, scale, { d: x > 330 ? -1 : 1, ...look }),
        dLabel(x, y + 48, label(key, 'name'), label(key, 'role')),
      );
    }
  }
  over.push(ell(320, CY - 18, 70, 82, 'apricot', 0.22, 'wcMid'), wamaya(320, CY + 56, 1.22));
  over.push(
    `<g transform="translate(320 ${CY + 80})"><rect x="-48" y="-17" width="96" height="34" rx="17" fill="${token('coral-fill')}"/><text x="0" y="0" dy=".35em" text-anchor="middle" class="fill-wc-light font-sans text-lg font-black">${esc(t('public.circle.diagram.amaya'))}</text></g>`,
  );
  return (
    `<defs><mask id="mCircleD" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="680"><circle cx="320" cy="${CY}" r="300" fill="${wv('light')}" filter="url(#wcFeather)"/></mask></defs>` +
    `<g mask="url(#mCircleD)"><g class="isolate"><rect width="640" height="680" fill="${wv('paper')}"/>${painted.join('')}${paperGrain(640, 680, 0.28)}</g></g>${over.join('')}`
  );
}

const STEP = { w: 160, h: 110 } as const;
const step = (id: string, inner: string[]) => wscene(id, STEP.w, STEP.h, inner.join(''), 6, true);

export const loopScenes = {
  moment: () =>
    step('mS1', [
      ell(80, 50, 90, 60, 'peach', 0.3),
      groundS(160, 110),
      mural(14, 24, 62, 44),
      wamaya(88, 99, 0.47),
      wfig(124, 100, 0.7, {
        dress: 'lilac',
        drape: 'ochre',
        hair: 'long',
        d: -1,
        phone: true,
      }),
      heartP(140, 22, 0.9),
      ln('M120 40Q130 30 136 26', 0.8, 0.45, 'charcoal', '2 3'),
    ]),
  thanks: () =>
    step('mS2', [
      ell(70, 60, 90, 60, 'apricot', 0.3),
      groundS(160, 110),
      wfig(52, 100, 0.72, { dress: 'rose', hair: 'long', d: 1, phone: true }),
      heartP(70, 24, 0.85),
      `<circle cx="124" cy="44" r="27" fill="${wv('paper')}" fill-opacity=".9"/>`,
      ell(124, 44, 26, 26, 'sky', 0.3, 'wcMid'),
      pth('M98 52q12 -10 26 -4t26 -2v14h-52Z', 'olive', 0.5, 'wcFig'),
      wfig(124, 70, 0.42, {
        dress: 'ochre',
        drape: 'roof',
        grey: true,
        bun: true,
        glasses: true,
        d: -1,
      }),
      `<circle cx="124" cy="44" r="27" fill="none" stroke="${wv('charcoal')}" stroke-width=".9" opacity=".4" filter="url(#wcInk)"/>`,
      heartP(146, 18, 0.6, 'rose'),
    ]),
  try: () =>
    step('mS3', [
      ell(80, 46, 90, 54, 'apricot', 0.32),
      ln('M80 0V14', 0.8, 0.5),
      pth('M68 20Q80 8 92 20Z', 'ochre', 0.8, 'wcFig'),
      wfig(52, 104, 0.7, { dress: 'rose', hair: 'long', d: 1 }),
      wamaya(106, 106, 0.52),
      pth('M10 78h140v8h-140Z', 'roof', 0.7, 'wcFig'),
      pth('M60 66l30 -4l4 14l-30 4Z', 'white', 0.95, 'wcFig'),
      ln('M64 70l20 -3M66 74l16 -2', 0.6, 0.4),
      tick(132, 58, 11, 'M127 58l3.5 3.5 6 -7'),
    ]),
  pulse: () =>
    step('mS4', [
      ell(90, 50, 90, 60, 'lilac', 0.26),
      groundS(160, 110),
      whome(22, 60, 0.34),
      whome(56, 62, 0.3),
      whome(90, 60, 0.32),
      heartP(22, 26, 0.55),
      heartP(56, 30, 0.5, 'ochre'),
      heartP(90, 26, 0.55),
      ln('M100 44Q116 30 124 46', 0.8, 0.45, 'charcoal', '2 3'),
      wfig(132, 100, 0.7, {
        dress: 'lilac',
        drape: 'ochre',
        hair: 'long',
        d: -1,
        phone: true,
      }),
    ]),
} as const;

const ruleBg = (c: 'apricot' | 'sky' | 'lilac' | 'teal') => ell(32, 32, 28, 28, c, 0.35, 'wcMid');

export const ruleIcons = {
  family: () => ruleBg('apricot') + whome(32, 50, 0.5) + heartP(32, 12, 0.7),
  photos: () =>
    ruleBg('sky') +
    pth('M12 24h40v26h-40Z', 'charcoal', 0.7, 'wcFig') +
    pth('M24 24l4 -6h8l4 6Z', 'charcoal', 0.7, 'wcFig') +
    `<circle cx="32" cy="37" r="8" fill="${wv('sky')}" fill-opacity=".9"/>` +
    tick(48, 48, 9, 'M44 48l3 3 5 -6', 2),
  quiet: () =>
    ruleBg('lilac') +
    `<path d="M40 14A18 18 0 1 0 50 44A14 14 0 0 1 40 14Z" fill="${wv('ochre')}" fill-opacity=".85" filter="url(#wcFig)"/>` +
    ln('M44 18h6l-6 7h6', 1.4, 0.7) +
    `<circle cx="16" cy="18" r="1.4" fill="${wv('charcoal')}" opacity=".6"/><circle cx="52" cy="34" r="1.2" fill="${wv('charcoal')}" opacity=".6"/>`,
  records: () =>
    ruleBg('teal') +
    pth('M32 10L50 17V31C50 42 42 50 32 54C22 50 14 42 14 31V17Z', 'sea', 0.7, 'wcFig') +
    heartP(32, 30, 0.95, 'white'),
} as const;
