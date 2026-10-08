/* Scenes for Why Quad, For school leaders, Your whole school, Privacy and safety, the demo and the small icons. */
import {
  bob,
  ell,
  esc,
  grass,
  heartP,
  ln,
  moon,
  pth,
  star4,
  teaRows,
  tick,
  token,
  vbirds,
  wscene,
  wstars,
  wv,
  type Point,
} from './paint';
import { AMAYA_KID, BOY, JAYA, wamaya, wfig, wkite } from './people';
import {
  cup,
  paper,
  plank,
  quadMark,
  wbus,
  whome,
  wpalm,
  wschool,
  wtree,
  wtuk,
  wwin,
} from './places';

import { t } from '@/i18n';

/** Why Quad: four 520 × 260 scenes. */
const S4 = (id: string, inner: string[]) => wscene(id, 520, 260, inner.join(''), 12, true);
const meadow = pth('M0 232Q260 224 520 232V260H0Z', 'olive', 0.2, 'wcBig');

export const ideaScenes = {
  // The principal at his morning desk with tea, a window onto the tea hills and a short story card
  story: () => {
    const lines = (
      [
        ['teal', 140],
        ['ochre', 118],
        ['rose', 128],
      ] as const
    )
      .map(
        ([c, w], i) =>
          `<circle cx="26" cy="${72 + i * 26}" r="6.5" fill="${wv(c)}" fill-opacity=".9"/>` +
          ln(`M44 ${72 + i * 26}h${w}`, 2, 0.32),
      )
      .join('');
    return S4('mStory', [
      ell(140, 80, 200, 120, 'peach', 0.26),
      ell(400, 130, 200, 130, 'apricot', 0.2),
      pth('M0 230Q260 222 520 230V260H0Z', 'olive', 0.2, 'wcBig'),
      wwin(
        40,
        30,
        150,
        104,
        pth('M40 30h150v104h-150Z', 'apricot', 0.4, 'wcMid') +
          `<circle cx="146" cy="104" r="18" fill="${wv('rose')}" fill-opacity=".7"/>` +
          pth('M40 106Q100 88 190 98V134H40Z', 'olive', 0.5, 'wcMid') +
          teaRows(40, 134, 150, 26, 3) +
          vbirds(70, 66, 0.6, 0.45),
      ),
      wfig(176, 236, 1.32, { top: 'sky', trousers: true, glasses: true, d: 1 }),
      plank(16, 196, 488, false),
      pth('M24 204h472v56h-472Z', 'roof', 0.2, 'wcMid'),
      cup(70, 178),
      paper(
        282,
        30,
        200,
        156,
        2,
        `<circle cx="26" cy="28" r="10" fill="${wv('apricot')}" fill-opacity=".8"/>` +
          ln('M46 24h110M46 36h80', 2.4, 0.5) +
          lines,
      ),
      bob(star4(482, 34, 9)),
    ]);
  },
  // A classroom where the trend dips on the chalkboard; Mr. Mendis steps in with a heart note
  warning: () =>
    S4('mWarn', [
      ell(140, 80, 200, 120, 'rose', 0.18),
      ell(420, 120, 180, 120, 'apricot', 0.2),
      pth('M0 232Q260 224 520 232V260H0Z', 'olive', 0.2, 'wcBig'),
      pth('M40 24h222v108h-222Z', 'sea', 0.82, 'wcMid'),
      ln('M40 24h222v108h-222Z', 2.6, 0.5, 'roof'),
      ln('M60 60L100 56L140 62L170 82L196 104', 2, 0.85, 'white'),
      ln('M196 104L238 64', 1.6, 0.8, 'ochre', '3 5'),
      `<circle cx="196" cy="104" r="5" fill="${wv('rose')}"/>`,
      wfig(90, 236, 0.92, { ...AMAYA_KID, d: 1 }),
      ell(180, 136, 34, 18, 'charcoal', 0.12, 'wcMid'),
      wfig(180, 238, 0.92, { ...BOY, d: 1 }),
      wfig(270, 236, 0.92, { ...BOY, d: -1, pants: 'olive' }),
      plank(50, 200, 76),
      plank(140, 200, 76),
      plank(230, 200, 76),
      `<ellipse cx="180" cy="176" rx="50" ry="62" fill="none" stroke="${wv('ochre')}" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round" opacity=".8"/>`,
      wfig(420, 246, 1.36, { top: 'teal', trousers: true, d: -1 }),
      paper(306, 34, 80, 50, -3, heartP(40, 24, 1.3)),
      ln('M232 168Q300 130 372 160', 1, 0.55, 'roof', '3 6'),
    ]),
  // Ms. Fernando's question on a paper note, and an answer card with two source tabs
  ask: () =>
    S4('mAsk', [
      ell(120, 100, 170, 120, 'teal', 0.14),
      ell(420, 110, 170, 110, 'apricot', 0.18),
      meadow,
      wfig(116, 250, 1.42, { dress: 'teal', drape: 'rose', hair: 'long', d: 1, phone: true }),
      plank(16, 214, 220, false),
      pth('M186 196h40v8h-40Z', 'teal', 0.8, 'wcFig'),
      pth('M190 188h34v8h-34Z', 'rose', 0.8, 'wcFig'),
      pth('M188 181h32v7h-32Z', 'ochre', 0.8, 'wcFig'),
      paper(
        150,
        22,
        84,
        56,
        -4,
        `<text x="42" y="42" text-anchor="middle" class="fill-wc-sea font-accent text-4xl font-semibold italic">?</text>`,
      ),
      paper(
        272,
        72,
        220,
        132,
        1,
        star4(26, 26, 11, 'teal') +
          star4(40, 36, 5, 'teal') +
          ln('M52 22h140M52 36h100', 2.4, 0.45) +
          pth('M18 66h82v46h-82Z', 'teal', 0.28, 'wcFig') +
          ln('M30 80h50M30 92h58M30 102h34', 1.6, 0.5, 'sea') +
          pth('M114 66h86v46h-86Z', 'lilac', 0.3, 'wcFig') +
          ln('M126 102L142 88L158 94L184 76', 2, 0.7, 'lilac'),
      ),
      ln('M236 60Q256 76 272 96', 0.9, 0.5, 'sea', '2 5'),
    ]),
  // Three painted school crests joined to one Quad mark, with children whose ties match each crest
  brand: () => {
    const crests = [
      [
        110,
        'roof',
        `<path d="M0 12C-11 6 -13 -6 -9 -15C-2 -8 0 1 0 12ZM0 12C11 6 13 -6 9 -15C2 -8 0 1 0 12ZM0 12C-7 1 -5 -12 0 -19C5 -12 7 1 0 12Z"/>`,
      ],
      [
        260,
        'teal',
        `<path d="M0 16C0 5 2 -4 7 -11" fill="none" stroke="${wv('light')}" stroke-width="3"/><path d="M7 -11C-2 -15 -11 -11 -15 -4C-6 -9 1 -10 7 -11ZM7 -11C16 -18 25 -13 27 -6C18 -11 12 -11 7 -11ZM7 -11C5 -20 11 -24 16 -24C11 -18 9 -14 7 -11Z"/>`,
      ],
      [410, 'lilac', `<path d="M-15 -9Q-7 -13 0 -9Q7 -13 15 -9V12Q7 8 0 12Q-7 8 -15 12Z"/>`],
    ] as const;
    return S4('mBrand', [
      ell(260, 110, 300, 140, 'apricot', 0.22),
      meadow,
      vbirds(40, 44, 0.7, 0.4),
      vbirds(440, 30, 0.6, 0.4),
      `<g transform="translate(260 30)"><circle r="22" fill="${wv('white')}" fill-opacity=".9" filter="url(#wcFig)"/>${quadMark(-14, -14, 0.44)}</g>`,
      ...crests.map(
        ([x, c, emblem], i) =>
          ln(`M260 52Q${(260 + x) / 2} 56 ${x} 64`, 0.9, 0.4, 'charcoal', '2 5') +
          `<g transform="translate(${x} 98)">${pth('M-30 -32H30V4Q30 26 0 38Q-30 26 -30 4Z', c, 0.85, 'wcFig')}${pth('M-30 -32H30V-22H-30Z', 'charcoal', 0.12, 'wcFig')}<g fill="${wv('light')}" fill-opacity=".92" transform="translate(0 2)">${emblem}</g></g>` +
          (i === 0
            ? wamaya(x, 246, 0.9)
            : wfig(x, 244, 0.92, i === 1 ? { ...BOY, tie: c } : { ...AMAYA_KID, tie: c, d: -1 })),
      ),
    ]);
  },
} as const;

/** For leaders: families as homes in the tea hills; lit windows have heard good news. */
export function villageScene(): string {
  const homes = (
    [
      [40, 132, 1],
      [104, 140, 1],
      [168, 130, 0],
      [232, 140, 1],
      [296, 132, 1],
      [360, 140, 1],
      [424, 130, 0],
      [74, 176, 1],
      [140, 182, 1],
      [206, 176, 1],
      [272, 182, 1],
      [338, 176, 1],
      [404, 182, 1],
    ] as const
  ).map(
    ([x, y, lit]) =>
      whome(x, y, 0.3, lit === 1) + (lit === 1 && x % 3 === 0 ? bob(heartP(x, y - 34, 0.5)) : ''),
  );
  return wscene(
    'mVillage',
    560,
    190,
    [
      ell(160, 50, 240, 90, 'peach', 0.3),
      ell(460, 40, 160, 70, 'apricot', 0.2),
      `<circle cx="494" cy="36" r="14" fill="${wv('apricot')}" fill-opacity=".8" filter="url(#wcMid)"/>`,
      moon(494, 36, 13),
      wstars([
        [60, 30],
        [200, 20],
        [330, 40],
        [420, 18],
      ]),
      vbirds(250, 40, 0.7, 0.4),
      pth('M-10 130Q140 90 300 112T570 104V190H-10Z', 'olive', 0.38, 'wcBig'),
      teaRows(0, 150, 300, 40, 3),
      teaRows(280, 150, 280, 40, 3),
      pth('M-10 170Q280 150 570 166V190H-10Z', 'teal', 0.25, 'wcBig'),
      ...homes,
      ln('M486 120Q450 64 424 88', 0.9, 0.55, 'roof', '3 6'),
      heartP(440, 74, 0.6),
      wfig(510, 178, 0.72, { ...JAYA, d: -1, wave: true }),
    ].join(''),
    8,
    true,
  );
}

/** Your whole school: the campus, with eight numbered pins for the modules (decorative). */
export function campusScene(): string {
  const S = 2.4;
  const X = 560;
  const Y = 344;
  const L = (lx: number, ly: number): Point => [X + lx * S, Y + ly * S];
  const pin = (n: number, [x, y]: Point) =>
    `<g transform="translate(${x} ${y})"><path d="M0 22L-9 8A18 18 0 1 1 9 8Z" fill="${token('coral-fill')}" filter="url(#wcFig)"/><circle r="12.5" fill="${wv('light')}" fill-opacity=".14"/><text y="1" dy=".35em" text-anchor="middle" class="fill-wc-light font-sans text-lg font-black">${n}</text></g>`;
  const office =
    `${pth('M-58 -33h18v10h-18Z', 'white', 0.95, 'wcFig')}<text x="-49" y="-25.4" text-anchor="middle" class="fill-wc-sea font-sans text-[7.5px] font-black">${esc(t('public.school.campusMoney'))}</text>` +
    `${pth('M40 -33h18v10h-18Z', 'white', 0.95, 'wcFig')}<path transform="translate(49 -28.6) scale(.34)" d="M0 -3C0 -9 -9 -10 -9 -3.5C-9 2 0 8 0 8S9 2 9 -3.5C9 -10 0 -9 0 -3Z" fill="${wv('rose')}"/>` +
    `<g fill="${wv('white')}">${[30, 38, 46, 54].map((i) => `<rect x="${i - 1.5}" y="-46" width="3" height="5" rx=".5"/>`).join('')}</g>`;
  return wscene(
    'mCampus',
    1080,
    400,
    [
      ell(300, 80, 500, 160, 'peach', 0.3),
      ell(880, 80, 260, 130, 'apricot', 0.2),
      `<circle cx="968" cy="70" r="26" fill="${wv('apricot')}" fill-opacity=".85" filter="url(#wcMid)"/>`,
      moon(968, 70, 22),
      wstars([
        [90, 40],
        [260, 30],
        [420, 60],
        [820, 30],
        [1030, 150],
      ]),
      vbirds(840, 110, 1, 0.45),
      bob(wkite('kamala', 330, 70, 0.7, 'peach', 8), 1),
      pth('M-20 300Q260 250 540 270T1100 266V340H-20Z', 'lilac', 0.22, 'wcBig'),
      pth('M700 310Q860 258 1100 276V344H700Z', 'teal', 0.34, 'wcBig'),
      teaRows(720, 344, 360, 60, 4),
      pth(`M-20 ${Y}Q540 ${Y - 8} 1100 ${Y}V400H-20Z`, 'olive', 0.4, 'wcBig'),
      ell(300, 390, 300, 30, 'teal', 0.16),
      grass(10, 1070, Y + 6, 396, 160, 0.4),
      wschool(X, Y, S, office),
      pth('M110 236h18v108h-18Z M220 236h18v108h-18Z', 'white', 0.95, 'wcFig'),
      pth('M120 236h8v108h-8Z M230 236h8v108h-8Z', 'sky', 0.22, 'wcFig'),
      `<path d="M114 240Q174 192 234 240" fill="none" stroke="${wv('roof')}" stroke-opacity=".8" stroke-width="9" stroke-linecap="round" filter="url(#wcFig)"/>`,
      ln('M142 288v56M154 282v62M194 282v62M206 288v56', 1.6, 0.45),
      wfig(178, 346, 0.86, { dress: 'rose', hair: 'long', d: 1 }),
      wfig(156, 346, 0.62, { ...AMAYA_KID, d: 1, wave: true }),
      `<g transform="translate(810 284)">${pth('M0 0h88v58h-88Z', 'roof', 0.55, 'wcFig')}${paper(8, 8, 24, 18, -3)}${paper(40, 10, 30, 22, 4)}${paper(14, 32, 26, 18, 2)}${ln('M8 58v34M80 58v34', 2, 0.5)}</g>`,
      wbus(920, Y + 2, 1),
      wtuk(296, Y + 4, 0.58),
      wpalm(40, Y + 4, 0.95),
      wpalm(1050, Y + 6, 0.8, -1),
      wtree(370, Y, 0.9),
      wtree(780, Y, 0.8),
      wamaya(470, Y + 6, 0.62),
      wfig(512, Y + 6, 0.62, { ...BOY, d: 1 }),
      wfig(650, Y + 6, 0.64, { ...AMAYA_KID, d: -1, wave: true, plaits: true }),
      pin(1, [174, 206]),
      pin(2, L(-42, -60)),
      pin(3, L(0, -34)),
      pin(4, L(20, -90)),
      pin(5, L(42, -60)),
      pin(6, L(49, -40)),
      pin(7, L(-49, -40)),
      pin(8, [854, 262]),
    ].join(''),
    30,
  );
}

/** Privacy and safety: four 260 × 150 scenes. */
const T = (id: string, inner: string[]) => wscene(id, 260, 150, inner.join(''), 8, true);

/** A ticked or crossed place in the family. */
function mark(x: number, y: number, ok: boolean): string {
  const path = ok ? 'M-3.5 0l2.5 2.5 4.5 -5' : 'M-3 -3l6 6M3 -3l-6 6';
  return `<g transform="translate(${x} ${y})"><circle r="7.5" fill="${wv(ok ? 'teal' : 'charcoal')}" fill-opacity="${ok ? 0.9 : 0.5}" filter="url(#wcFig)"/><path d="${path}" stroke="${wv('light')}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
}

export const trustScenes = {
  // The school inside its own painted ring, with a padlock; other schools faint outside
  wall: () =>
    T('mWall', [
      ell(130, 70, 140, 80, 'sky', 0.26),
      pth('M0 132Q130 124 260 132V150H0Z', 'olive', 0.3, 'wcBig'),
      `<g opacity=".35">${wschool(18, 132, 0.32)}${wschool(244, 132, 0.32)}</g>`,
      `<ellipse cx="130" cy="96" rx="92" ry="58" fill="none" stroke="${wv('teal')}" stroke-opacity=".3" stroke-width="12" filter="url(#wcMid)"/><ellipse cx="130" cy="96" rx="92" ry="58" fill="none" stroke="${wv('sea')}" stroke-width="1.4" stroke-dasharray="3 6" opacity=".8"/>`,
      wschool(130, 132, 0.78),
      `<g transform="translate(208 118)">${pth('M-12 -6h24v20h-24Z', 'ochre', 0.9, 'wcFig')}${ln('M-7 -6V-12A7 7 0 0 1 7 -12V-6', 2.6, 0.8, 'ochre')}<circle cy="3" r="2.6" fill="${wv('charcoal')}"/></g>`,
    ]),
  // Mum holding a photo of Amaya; Grandma and Grandpa ticked, an empty place crossed
  consent: () =>
    T('mConsent', [
      ell(100, 80, 120, 80, 'apricot', 0.28),
      pth('M0 134Q130 126 260 134V150H0Z', 'olive', 0.26, 'wcBig'),
      wfig(66, 150, 1.12, { dress: 'rose', hair: 'long', d: 1 }),
      paper(
        80,
        70,
        44,
        36,
        -6,
        pth('M4 4h36v24h-36Z', 'peach', 0.5, 'wcFig') + wamaya(22, 30, 0.2),
      ),
      wfig(172, 98, 0.5, {
        dress: 'ochre',
        drape: 'roof',
        grey: true,
        bun: true,
        glasses: true,
        d: -1,
      }),
      wfig(214, 116, 0.5, { top: 'white', trousers: true, grey: true, glasses: true, d: -1 }),
      `<ellipse cx="188" cy="126" rx="10" ry="12" fill="none" stroke="${wv('charcoal')}" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/>`,
      mark(184, 72, true),
      mark(226, 90, true),
      mark(198, 132, false),
    ]),
  // A locked folder with a heart, and a log of who viewed it
  lock: () =>
    T('mLock', [
      ell(130, 76, 140, 80, 'rose', 0.2),
      pth('M0 134Q130 126 260 134V150H0Z', 'olive', 0.24, 'wcBig'),
      pth('M60 44H110L120 54H188V130H60Z', 'lilac', 0.7, 'wcMid'),
      paper(70, 60, 110, 64, 0, heartP(55, 30, 1.5)),
      `<g transform="translate(186 112)">${pth('M-16 -6h32v26h-32Z', 'ochre', 0.9, 'wcFig')}${ln('M-9 -6V-14A9 9 0 0 1 9 -14V-6', 3.4, 0.85, 'ochre')}<circle cy="5" r="3.2" fill="${wv('charcoal')}"/></g>`,
      `<g transform="translate(222 44)"><circle r="15" fill="${wv('white')}" fill-opacity=".92" filter="url(#wcFig)"/>${ln('M-9 0Q0 -9 9 0Q0 9 -9 0Z', 1.6, 0.7)}<circle r="2.8" fill="${wv('charcoal')}"/></g>`,
      ln('M208 68h28M208 76h20M208 84h24', 1.6, 0.45),
    ]),
  // Sri Lanka in teal with a pin, inside the region; data in the cloud, ticked
  local: () =>
    T('mLocal', [
      ell(130, 76, 140, 80, 'teal', 0.2),
      vbirds(26, 34, 0.6, 0.4),
      `<ellipse cx="130" cy="74" rx="62" ry="62" fill="none" stroke="${wv('sea')}" stroke-width="1.4" stroke-dasharray="3 7" opacity=".7"/>`,
      `<g transform="translate(76 4)">${pth('M50 8C44 8 42 14 44 20C46 30 38 42 34 58C28 82 34 104 50 118C64 128 84 122 92 104C100 84 92 62 80 46C70 32 58 22 55 12C54 9 52 8 50 8Z', 'teal', 0.8, 'wcMid')}${teaRows(40, 112, 54, 36, 3)}<g transform="translate(62 70)">${pth('M0 18C-10 6 -14 -2 -14 -8A14 14 0 0 1 14 -8C14 -2 10 6 0 18Z', 'rose', 0.92, 'wcFig')}<circle cy="-8" r="5" fill="${wv('light')}"/></g></g>`,
      `<g transform="translate(214 40)">${ell(0, 4, 26, 13, 'white', 0.9, 'wcFig')}${ell(-8, -2, 12, 10, 'white', 0.9, 'wcFig')}${tick(6, 3, 8, 'M2.5 3l2.5 2.5 5 -5.5', 2)}</g>`,
    ]),
} as const;

/** Demo: a Quad guide and the principal at a table with a closed laptop, cups and a teapot. */
export function teaScene(): string {
  return wscene(
    'mTea',
    480,
    220,
    [
      ell(240, 100, 260, 120, 'apricot', 0.24),
      ell(90, 60, 120, 80, 'peach', 0.18),
      pth('M0 206Q240 200 480 206V220H0Z', 'olive', 0.2, 'wcBig'),
      wtree(40, 152, 0.7),
      wfig(128, 214, 1.32, { dress: 'ochre', drape: 'lilac', hair: 'long', d: 1 }),
      wfig(358, 214, 1.34, { top: 'sky', trousers: true, glasses: true, d: -1 }),
      plank(40, 150, 400),
      pth('M206 104h68l-6 46h-56Z', 'sky', 0.65, 'wcFig'),
      ln('M200 150h80', 2.4, 0.5),
      quadMark(228, 116, 0.38, wv('light')),
      cup(156, 132, 'teal'),
      cup(310, 132, 'rose'),
      pth('M378 124q0 -14 14 -14h8q14 0 14 14v12q0 4 -4 4h-28q-4 0 -4 -4Z', 'ochre', 0.85, 'wcFig'),
      ln('M414 120q10 -2 12 -10', 1.6, 0.55),
      bob(heartP(240, 40, 1)),
      star4(212, 62, 6),
    ].join(''),
    10,
    true,
  );
}

/** Small painted icons: the strip and the band foot. */
export const smallIcons = {
  family: () =>
    ell(20, 20, 18, 18, 'rose', 0.32, 'wcMid') +
    wfig(15, 37, 0.32, { dress: 'rose', hair: 'long', d: 1 }) +
    wamaya(26, 37, 0.24),
  crest: () =>
    ell(20, 20, 18, 18, 'apricot', 0.36, 'wcMid') +
    pth('M10 9H30V21Q30 29 20 33Q10 29 10 21Z', 'roof', 0.88, 'wcFig') +
    `<path d="M20 27C15 24 14 19 16 15C18 18 20 21 20 27ZM20 27C25 24 26 19 24 15C22 18 20 21 20 27Z" fill="${wv('light')}" fill-opacity=".92"/>`,
  lanka: () =>
    ell(20, 20, 18, 18, 'teal', 0.28, 'wcMid') +
    pth(
      'M18 6C15 6 14 9 15 12C16 15 13 19 13 24C13 30 16 34 21 34C26 34 28 29 27 24C26 18 23 13 20 8Z',
      'sea',
      0.85,
      'wcFig',
    ),
  shield: () =>
    `<circle cx="22" cy="22" r="20" fill="${wv('light')}" fill-opacity=".07"/>` +
    pth('M22 8L34 13V22C34 29 29 34 22 37C15 34 10 29 10 22V13Z', 'teal', 0.9, 'wcFig') +
    `<path d="M17 22l4 4 7 -8" stroke="${wv('light')}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
} as const;
