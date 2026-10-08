/* A day in the circle: seven 400 × 200 vignettes, painted on paper that fades into the band. */
import {
  bob,
  ell,
  esc,
  heartP,
  ln,
  pth,
  sk,
  star4,
  teaRows,
  tick,
  vbirds,
  wscene,
  wv,
} from './paint';
import { JAYA, wamaya, wfig, wkite } from './people';
import { cup, mural, paper, plank, sofa, wpalm, wstupa, wwin } from './places';

import { t } from '@/i18n';

const V = (id: string, inner: string[]) => wscene(id, 400, 200, inner.join(''), 14, true);

export const dayScenes = {
  // 07:42: Amaya walks in through the school gate; her day ring starts on Mum's phone
  arrive: () =>
    V('mGate', [
      ell(310, 50, 120, 80, 'apricot', 0.4),
      `<circle cx="318" cy="50" r="17" fill="${wv('apricot')}" fill-opacity=".85" filter="url(#wcMid)"/>`,
      vbirds(214, 46, 0.7, 0.45),
      pth('M0 160Q200 146 400 156V200H0Z', 'olive', 0.38, 'wcBig'),
      teaRows(220, 170, 180, 30, 3),
      pth('M120 200Q140 176 170 162L200 162Q194 180 214 200Z', 'ochre', 0.32, 'wcBig'),
      pth('M54 70h20v96h-20Z M184 70h20v96h-20Z', 'white', 0.95, 'wcFig'),
      pth('M66 70h8v96h-8Z M196 70h8v96h-8Z', 'sky', 0.22, 'wcFig'),
      ln('M54 70h20v96h-20ZM184 70h20v96h-20Z', 0.6, 0.32),
      sk('M58 74Q129 22 200 74', 'roof', 9, 0.8),
      pth('M104 46h50v14h-50Z', 'white', 0.95, 'wcFig'),
      ln('M110 52h38', 1, 0.4),
      ln('M84 112v54M96 106v60M162 106v60M174 112v54', 1.6, 0.45),
      wamaya(132, 176, 0.86),
      sk('M332 106a26 26 0 0 1 26 26', 'teal', 7, 0.7),
      sk('M358 132a26 26 0 0 1 -26 26', 'lilac', 7, 0.4),
      sk('M332 158a26 26 0 0 1 -26 -26', 'rose', 7, 0.35),
      tick(332, 132, 11, 'M327 132l3.5 3.5 6 -7'),
      ln('M166 120Q240 100 296 124', 0.9, 0.45, 'charcoal', '2 5'),
      wpalm(384, 170, 0.5, -1),
    ]),
  // 08:55: Amaya paints the canteen mural while Ms. Jayasinghe shares it
  moment: () =>
    V('mMoment', [
      ell(200, 90, 230, 120, 'apricot', 0.22),
      pth('M0 172Q200 166 400 172V200H0Z', 'olive', 0.26, 'wcBig'),
      mural(20, 26, 176, 104),
      wamaya(150, 184, 0.88),
      ln('M159 136L176 108', 2, 0.75, 'roof'),
      `<circle cx="177" cy="106" r="3" fill="${wv('rose')}" fill-opacity=".9"/>`,
      wfig(300, 186, 1, { ...JAYA, d: -1, phone: true }),
      ln('M290 104Q312 64 342 46', 0.9, 0.45, 'charcoal', '2 4'),
      bob(heartP(350, 40, 1.3)),
      star4(326, 74, 5),
    ]),
  // 09:10: Grandma in Kandy loves the moment, in her armchair by the window onto the tea hills
  grandma: () =>
    wscene(
      'mGrandma',
      400,
      200,
      [
        ell(190, 100, 260, 140, 'apricot', 0.36),
        ell(90, 50, 150, 90, 'peach', 0.3),
        ell(320, 160, 160, 80, 'lilac', 0.18),
        pth('M236 26h134v94h-134Z', 'sky', 0.32, 'wcMid'),
        pth('M236 84Q270 62 300 74T370 66V120H236Z', 'olive', 0.45, 'wcMid'),
        teaRows(236, 120, 134, 40, 4),
        pth('M236 96Q290 84 370 98V120H236Z', 'teal', 0.35, 'wcMid'),
        wstupa(330, 76, 0.35),
        vbirds(256, 50, 0.5, 0.4),
        ln('M236 26h134v94h-134ZM303 26v94M236 73h134', 1.6, 0.55),
        pth('M0 168Q200 158 400 168V200H0Z', 'olive', 0.25, 'wcBig'),
        pth('M206 132h44v6h-44Z', 'roof', 0.6, 'wcFig'),
        ln('M212 138v40M244 138v40', 1.6, 0.5),
        pth('M218 118h18v10q0 6 -6 6h-6q-6 0 -6 -6Z', 'white', 0.9, 'wcFig'),
        ln('M223 112q-3 -6 0 -11M231 112q-3 -6 0 -11', 0.9, 0.45),
        pth('M54 74Q54 46 84 46H162Q192 46 192 74V176H54Z', 'rose', 0.5, 'wcMid'),
        pth('M44 116q0 -8 10 -8h14v66h-24Z M178 108h14q10 0 10 8v58h-24Z', 'rose', 0.62, 'wcMid'),
        // Grandma, three-quarter view, facing the window
        pth('M92 176L94 130Q96 112 124 108Q150 112 154 130L156 150Z', 'ochre', 0.85, 'wcFig'),
        pth('M94 148Q130 140 172 150Q182 160 176 176H94Z', 'ochre', 0.85, 'wcFig'),
        pth('M94 148Q130 140 172 150Q182 160 176 176H94Z', 'roof', 0.14, 'wcFig'),
        ln('M120 152Q122 164 118 176M134 150Q137 164 134 176M148 151Q152 164 150 176', 0.7, 0.35),
        pth(
          'M100 114Q118 128 132 150Q142 162 150 176H138Q128 160 118 148Q106 134 96 126Z',
          'roof',
          0.5,
          'wcFig',
        ),
        pth('M118 104h12v12h-12Z', 'skin', 0.9, 'wcFig'),
        `<circle cx="120" cy="88" r="16" fill="${wv('white')}" fill-opacity=".95" filter="url(#wcFig)"/><circle cx="104" cy="84" r="7" fill="${wv('white')}" fill-opacity=".95" filter="url(#wcFig)"/>`,
        `<circle cx="126" cy="91" r="14.5" fill="${wv('skin')}" fill-opacity=".92" filter="url(#wcFig)"/>`,
        `<path d="M110 82Q122 72 140 84" fill="none" stroke="${wv('white')}" stroke-width="5" stroke-linecap="round"/>`,
        `<ellipse cx="136" cy="98" rx="3.6" ry="2.6" fill="${wv('rose')}" fill-opacity=".6"/><circle cx="134" cy="89" r="4.2" fill="none" stroke="${wv('charcoal')}" stroke-width=".8" opacity=".6"/><path d="M139 92q2 1 0 3" fill="none" stroke="${wv('charcoal')}" stroke-width=".8" opacity=".5"/>`,
        sk('M146 124Q160 140 150 146', 'ochre', 7, 0.85),
        `<circle cx="150" cy="146" r="4" fill="${wv('skin')}" fill-opacity=".9"/>`,
        pth('M146 132h9v15h-9Z', 'charcoal', 0.75, 'wcFig'),
        bob(
          pth('M170 46c-6 -8 -16 -2 -10 6l10 9l10 -9c6 -8 -4 -14 -10 -6Z', 'rose', 0.85, 'wcFig'),
        ),
        bob(pth('M194 26c-4 -5 -10 -1 -6 4l6 5l6 -5c4 -5 -2 -9 -6 -4Z', 'ochre', 0.8, 'wcFig'), 1),
        ln('M156 132Q164 96 168 64', 0.7, 0.35, 'charcoal', '2 4'),
      ].join(''),
      16,
      true,
    ),
  // 12:30: Dad at his desk sends up kites for the people around Amaya
  people: () =>
    V('mPeople', [
      ell(110, 90, 160, 100, 'apricot', 0.24),
      ell(300, 60, 140, 80, 'peach', 0.22),
      pth('M0 176Q200 170 400 176V200H0Z', 'olive', 0.24, 'wcBig'),
      wfig(84, 190, 1.02, { top: 'sea', trousers: true, d: 1, phone: true }),
      pth('M120 120h60l6 30h-72Z', 'sky', 0.55, 'wcFig'),
      plank(20, 150, 200),
      ...(
        [
          ['jaya', 232, 64, 0.58, 'lilac', -6],
          ['herath', 300, 44, 0.52, 'apricot', 6],
          ['dias', 356, 100, 0.48, 'teal', 10],
        ] as const
      ).map(
        ([who, x, y, s, c, r]) =>
          ln(`M98 128Q${(98 + x) / 2} ${y + 60} ${x} ${y + 26 * s}`, 0.8, 0.4, 'charcoal', '2 5') +
          bob(wkite(who, x, y, s, c, r)),
      ),
      bob(heartP(196, 110, 0.9), 1),
    ]),
  // 18:20: Mum and Amaya write the postcard to Grandma at the kitchen table
  try: () =>
    V('mTry', [
      ell(190, 90, 220, 120, 'apricot', 0.34),
      ln('M200 0V30', 0.9, 0.5),
      pth('M180 46Q200 20 220 46Z', 'ochre', 0.85, 'wcFig'),
      `<ellipse cx="200" cy="56" rx="60" ry="26" fill="${wv('window')}" opacity=".3" filter="url(#wcBloom)"/>`,
      wwin(
        290,
        22,
        92,
        70,
        pth('M290 22h92v70h-92Z', 'peach', 0.45, 'wcMid') +
          pth('M290 70Q330 54 382 64V92H290Z', 'olive', 0.45, 'wcMid'),
      ),
      wfig(132, 188, 1.06, { dress: 'rose', hair: 'long', d: 1 }),
      wamaya(226, 194, 0.96),
      pth('M30 148h340v10h-340Z', 'roof', 0.66, 'wcFig'),
      pth('M40 158h320v42h-320Z', 'roof', 0.22, 'wcMid'),
      paper(
        158,
        130,
        56,
        30,
        -6,
        ln('M8 9h26M8 16h30M8 23h20', 0.6, 0.4) + pth('M42 6h9v10h-9Z', 'rose', 0.8, 'wcFig'),
      ),
      tick(318, 134, 12, 'M312.5 134l4 4 7 -8', 2.4),
      pth('M346 140h30v8h-30Z', 'teal', 0.75, 'wcFig'),
      pth('M348 133h26v7h-26Z', 'rose', 0.75, 'wcFig'),
      pth('M346 127h28v6h-28Z', 'ochre', 0.75, 'wcFig'),
    ]),
  // 19:30: Ms. Jayasinghe reads at home under a night window; a message waits for 07:00
  quiet: () => {
    const couch = sofa(160, 100, 170, 'teal');
    const stars = (
      [
        [44, 40],
        [70, 58],
        [52, 92],
        [92, 86],
        [128, 100],
        [40, 70],
      ] as const
    )
      .map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.4" fill="${wv('light')}" opacity=".85"/>`)
      .join('');
    return V('mQuiet', [
      ell(200, 100, 230, 120, 'lilac', 0.26),
      wwin(
        26,
        22,
        120,
        92,
        pth('M26 22h120v92h-120Z', 'sky', 0.75, 'wcMid') +
          `<circle cx="108" cy="50" r="13" fill="${wv('moonlight')}" fill-opacity=".95"/><circle cx="114" cy="46" r="12" fill="${wv('sky')}" fill-opacity=".9"/>` +
          stars,
      ),
      couch.back,
      wfig(244, 168, 1.02, {
        ...JAYA,
        d: -1,
        hold: pth('M-14 -6h24v14h-24Z', 'rose', 0.9, 'wcFig') + ln('M-2 -6v14', 0.6, 0.5),
      }),
      couch.front,
      plank(340, 150, 44, true),
      cup(350, 132, 'white', 0.9),
      paper(338, 46, 46, 30, 0, ln('M0 0L23 16L46 0', 0.7, 0.45)),
      `<circle cx="384" cy="78" r="12" fill="${wv('lilac')}" fill-opacity=".85" filter="url(#wcFig)"/><path d="M384 71v7l4.5 3" fill="none" stroke="${wv('light')}" stroke-width="2" stroke-linecap="round"/>`,
      `<text x="362" y="108" text-anchor="middle" class="fill-ink-2 font-sans text-[13px] font-extrabold">${esc(t('public.day.quietClock'))}</text>`,
      ln('M296 66h6l-6 7h6M308 54h4l-4 5h4', 1.2, 0.55),
    ]);
  },
  // Friday: the family on the sofa under bunting with the recap card
  recap: () => {
    const couch = sofa(70, 106, 260, 'rose');
    const bunting = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const x = 34 + i * 46;
      const y = 30 + Math.sin((i / 7) * Math.PI) * 12;
      const colour = (['rose', 'ochre', 'teal', 'lilac'] as const)[i % 4] ?? 'rose';
      return pth(`M${x - 8} ${y}h16l-8 16Z`, colour, 0.8, 'wcFig');
    });
    const bars = (
      [
        [12, 26, 'lilac'],
        [28, 18, 'teal'],
        [44, 11, 'ochre'],
      ] as const
    )
      .map(
        ([x, h, c]) =>
          `<rect x="${x}" y="${36 - h}" width="9" height="${h}" rx="2" fill="${wv(c)}" fill-opacity=".85"/>`,
      )
      .join('');
    return V('mRecap', [
      ell(200, 100, 230, 120, 'peach', 0.28),
      ln('M20 26Q110 50 200 28T380 26', 0.8, 0.45),
      ...bunting,
      couch.back,
      wfig(128, 186, 1, { top: 'sea', trousers: true, d: 1 }),
      wfig(276, 186, 1, { dress: 'rose', hair: 'long', d: -1 }),
      wamaya(204, 192, 0.9),
      paper(172, 128, 64, 44, -3, bars),
      couch.front,
      bob(star4(200, 70, 8)),
      star4(164, 80, 5, 'teal'),
      star4(238, 80, 5, 'lilac'),
    ]);
  },
} as const;

export type DayScene = keyof typeof dayScenes;
