/* Quad greeting scenes: one source for the prototypes (CSS-variable palette, follows light/dark)
   and for the exported asset files (fixed light and dark palettes, see export in this folder's README).
   Time bands (school time zone on web, device time in the parent app):
     morning   05:00–11:59  "Good morning"
     afternoon 12:00–16:59  "Good afternoon"
     evening   17:00–19:59  "Good evening"
     night     20:00–04:59  "Good evening" (until midnight), then "Hello"            */
(function (root) {
  const PERIODS = [
    {k: 'morning', from: 5, to: 12, word: 'Good morning', label: 'Morning'},
    {k: 'afternoon', from: 12, to: 17, word: 'Good afternoon', label: 'Afternoon'},
    {k: 'evening', from: 17, to: 20, word: 'Good evening', label: 'Evening'},
    {k: 'night', from: 20, to: 29, word: 'Good evening', label: 'Night'}
  ];
  function greetPeriod(d) {
    d = d || new Date();
    let forced = null; try { forced = sessionStorage.getItem('quad-greet-period'); } catch (e) {}
    const h = d.getHours();
    const p = PERIODS.find(x => x.k === forced) || PERIODS.find(x => (h >= x.from && h < x.to) || (h + 24 >= x.from && h + 24 < x.to));
    return {...p, word: p.k === 'night' && !forced && h < 5 ? 'Hello' : p.word};
  }

  // Palettes. The prototypes use CSS variables so the scene follows the theme; asset export uses hex.
  const VARS = {surface: 'var(--surface)', ink3: 'var(--ink-3)', c1: 'var(--c1)', c2: 'var(--c2)', c3: 'var(--c3)', c4: 'var(--c4)', c5: 'var(--c5)', deep: 'var(--rail, #101632)'};
  // Values from design/system/tokens.css (light and dark): surface, ink-3, c1–c5 and the rail.
  const LIGHT = {surface: '#FFFFFF', ink3: '#5A5F7B', c1: '#E0478A', c2: '#4048B8', c3: '#1F8ACF', c4: '#D9640B', c5: '#4E8A12', deep: '#101632'};
  const DARK = {surface: '#171D45', ink3: '#A9ACC8', c1: '#FF6FAE', c2: '#8C93FF', c3: '#59C3FF', c4: '#FF9B45', c5: '#C8F169', deep: '#0A0D24'};

  const hex = s => /^#[0-9a-f]{6}$/i.test(s);
  const toRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  // mix(a, pct, b): pct% of a over b. Hex in → hex out; CSS variables → color-mix().
  const mix = (a, pct, b) => {
    if (hex(a) && hex(b)) { const A = toRgb(a), B = toRgb(b); return '#' + A.map((v, i) => Math.round(v * pct / 100 + B[i] * (1 - pct / 100)).toString(16).padStart(2, '0')).join(''); }
    return `color-mix(in srgb,${a} ${pct}%,${b})`;
  };
  const fill = c => hex(c) ? `fill="${c}"` : `style="fill:${c}"`;
  const stroke = c => hex(c) ? `stroke="${c}"` : `style="stroke:${c}"`;
  const stop = (o, c, op) => hex(c) ? `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>` : `<stop offset="${o}" style="stop-color:${c}${op != null ? `;stop-opacity:${op}` : ''}"/>`;

  const birds = (P, op) => `<g fill="none" ${stroke(P.ink3)} stroke-width="2.4" stroke-linecap="round" opacity="${op}"><path d="M842 92q9-9 18 0q9-9 18 0"/><path d="M892 64q7-7 14 0q7-7 14 0"/><path d="M790 120q6-6 12 0q6-6 12 0"/></g>`;
  const water = (P, op) => `<g fill="none" ${stroke(P.surface)} stroke-width="2" stroke-linecap="round" opacity="${op}"><path d="M560 300c80-10 170-12 250-6"/><path d="M860 290c80-9 170-11 260-6"/><path d="M700 312c90-8 190-9 280-4"/></g>`;
  const hills = (P, a, b, c, d) => `<path d="M0 236C170 214 330 226 500 212S820 150 1000 168 1150 176 1200 170V320H0Z" ${fill(a[0])} opacity="${a[1]}"/>
  <path d="M0 262C210 240 400 258 610 240S960 206 1200 222V320H0Z" ${fill(b[0])} opacity="${b[1]}"/>
  <path d="M0 290C260 272 500 290 760 272S1060 252 1200 262V320H0Z" ${fill(c[0])} opacity="${c[1]}"/>
  ${water(P, .35)}
  <path d="M0 308C300 298 620 310 900 300S1120 292 1200 296V320H0Z" ${fill(d[0])} opacity="${d[1]}"/>`;
  const cloud = (P, x, y, s, op) => `<g transform="translate(${x} ${y}) scale(${s})" ${fill(mix('#FFFFFF', 34, P.surface))} opacity="${op}"><ellipse cx="0" cy="10" rx="54" ry="16"/><circle cx="-18" cy="0" r="20"/><circle cx="12" cy="-6" r="26"/><circle cx="38" cy="4" r="16"/></g>`;
  const stars = (P) => { const pts = [[640, 60, 2], [700, 120, 1.6], [760, 40, 2.4], [820, 96, 1.4], [880, 30, 1.8], [930, 140, 1.4], [1080, 52, 2], [1140, 110, 1.6], [1170, 36, 1.4], [600, 150, 1.4], [980, 70, 1.4], [1120, 170, 1.2]];
    return `<g fill="#FFFFFF">${pts.map(([x, y, r], i) => `<circle class="gs-star" cx="${x}" cy="${y}" r="${r}" opacity="${.55 + (i % 3) * .15}" style="animation-delay:${(i % 5) * .6}s"/>`).join('')}</g>`; };

  function greetScene(period, id, P, opts) {
    P = P || VARS; id = id || 'gs'; opts = opts || {};
    const k = typeof period === 'string' ? period : period.k;
    const cls = opts.cls == null ? 'mscene gscene gs-' + k : opts.cls;
    const size = opts.size ? ` width="${opts.size[0]}" height="${opts.size[1]}"` : '';
    const open = `<svg ${cls ? `class="${cls}" ` : ''}xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"${size} preserveAspectRatio="xMaxYMax slice" aria-hidden="true">`;
    let body = '';
    if (k === 'morning') body = `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="1" y2="1">${stop(0, P.surface)}${stop(.55, mix(P.c3, 10, P.surface))}${stop(1, mix(P.c1, 16, P.surface))}</linearGradient>
  <radialGradient id="${id}-glow" cx="1010" cy="190" r="300" gradientUnits="userSpaceOnUse">${stop(0, P.c1, .32)}${stop(.45, P.c1, .1)}${stop(1, P.c1, 0)}</radialGradient></defs>
  <rect width="1200" height="320" fill="url(#${id}-sky)"/><rect width="1200" height="320" fill="url(#${id}-glow)"/>
  <circle class="ms-sun gs-body" cx="1010" cy="196" r="58" ${fill(P.c1)} opacity=".85"/>
  ${birds(P, .7)}
  ${hills(P, [P.c3, .16], [P.c3, .3], [P.c2, .42], [P.c2, .6])}`;
    else if (k === 'afternoon') body = `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="1" y2="1">${stop(0, P.surface)}${stop(.5, mix(P.c5, 9, P.surface))}${stop(1, mix(P.c4, 20, P.surface))}</linearGradient>
  <radialGradient id="${id}-glow" cx="980" cy="86" r="260" gradientUnits="userSpaceOnUse">${stop(0, P.c4, .38)}${stop(.5, P.c4, .1)}${stop(1, P.c4, 0)}</radialGradient></defs>
  <rect width="1200" height="320" fill="url(#${id}-sky)"/><rect width="1200" height="320" fill="url(#${id}-glow)"/>
  <circle cx="980" cy="86" r="74" fill="none" ${stroke(P.c4)} stroke-width="2" stroke-dasharray="2 12" stroke-linecap="round" opacity=".55"/>
  <circle class="ms-sun gs-body" cx="980" cy="86" r="46" ${fill(P.c4)} opacity=".95"/>
  ${cloud(P, 780, 96, 1, .9)}${cloud(P, 1110, 150, .7, .8)}${cloud(P, 640, 140, .55, .7)}
  ${hills(P, [P.c5, .16], [P.c5, .28], [P.c2, .4], [P.c2, .58])}`;
    else if (k === 'evening') body = `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="1" y2="1">${stop(0, P.surface)}${stop(.4, mix(P.c3, 14, P.surface))}${stop(.75, mix(P.c1, 26, P.surface))}${stop(1, mix(P.c4, 34, P.surface))}</linearGradient>
  <radialGradient id="${id}-glow" cx="1000" cy="250" r="360" gradientUnits="userSpaceOnUse">${stop(0, P.c4, .5)}${stop(.35, P.c1, .22)}${stop(1, P.c1, 0)}</radialGradient>
  <linearGradient id="${id}-sun" x1="0" y1="0" x2="0" y2="1">${stop(0, P.c4)}${stop(1, P.c1)}</linearGradient>
  <clipPath id="${id}-hz"><path d="M0 0H1200V170C1150 176 1100 168 1000 168S820 150 500 212 170 214 0 236Z"/></clipPath></defs>
  <rect width="1200" height="320" fill="url(#${id}-sky)"/><rect width="1200" height="320" fill="url(#${id}-glow)"/>
  <g clip-path="url(#${id}-hz)"><circle class="ms-sun gs-body" cx="1000" cy="214" r="78" fill="url(#${id}-sun)"/></g>
  <g ${stroke(P.c1)} stroke-width="3" stroke-linecap="round" opacity=".35"><path d="M900 150h-46M1100 150h46M930 106l-30-22M1070 106l30-22M1000 84V56"/></g>
  ${birds({...P, ink3: P.deep}, .55)}
  ${hills(P, [P.c3, .26], [P.c2, .38], [P.deep, .5], [P.deep, .72])}`;
    else body = `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="1" y2=".6">${stop(0, P.surface)}${stop(.38, mix(P.c3, 16, P.surface))}${stop(.7, mix(P.c2, 42, P.surface))}${stop(1, mix(P.deep, 78, P.surface))}</linearGradient>
  <radialGradient id="${id}-glow" cx="1010" cy="96" r="200" gradientUnits="userSpaceOnUse">${stop(0, P.c3, .4)}${stop(1, P.c3, 0)}</radialGradient>
  <mask id="${id}-moon"><rect width="1200" height="320" fill="#fff"/><circle cx="1032" cy="80" r="40" fill="#000"/></mask></defs>
  <rect width="1200" height="320" fill="url(#${id}-sky)"/><rect width="1200" height="320" fill="url(#${id}-glow)"/>
  ${stars(P)}
  <circle class="ms-sun gs-body" cx="1010" cy="96" r="44" ${fill(mix('#FFFFFF', 78, P.c3))} mask="url(#${id}-moon)"/>
  ${hills(P, [P.c3, .22], [P.c2, .42], [P.deep, .6], [P.deep, .82])}`;
    return `${open}\n  ${body}</svg>`;
  }

  // Small glyphs for compact headers (parent app header dot, email, notifications): 24×24, stroke icons
  function greetIcon(period, color, size) {
    const k = typeof period === 'string' ? period : period.k, c = color || 'currentColor', s = size || 24;
    const g = {
      morning: '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 5v3M5.6 9.6l2.1 2.1M18.4 9.6l-2.1 2.1"/>',
      afternoon: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
      evening: '<path d="M3 16h18M6 20h12"/><path d="M7 16a5 5 0 0 1 10 0"/><path d="M12 6v3M4.9 10.4l1.8 1M19.1 10.4l-1.8 1"/>',
      night: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><path d="M17 3.5v2M16 4.5h2"/>'
    }[k];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`;
  }

  const api = {PERIODS, greetPeriod, greetScene, greetIcon, LIGHT, DARK, VARS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
