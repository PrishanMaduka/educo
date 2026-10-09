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

  // Palettes: the landing page's flat colours as named keys, plus a few roles that change with the backdrop.
  // DARK is for scenes on navy (the apps' greeting card); LIGHT is for scenes on cream (design/brand.html).
  //   muted: birds and the kite's string · cloud · hill: the sky back hill (morning, afternoon)
  //   moon and star: night · deep: the front night hill, one step away from the card colour
  // The prototypes use CSS variables (design/system/tokens.css) so a container can retune a role with --gs-*.
  const VARS = {navy: 'var(--navy)', navy2: 'var(--navy-2)', navyLine: 'var(--navy-line)', cream: 'var(--on-navy)',
    lime: 'var(--lime)', pink: 'var(--pink)', sky: 'var(--sky)', orange: 'var(--orange)', violet: 'var(--violet, #8C93FF)',
    muted: 'var(--gs-muted, var(--on-navy-3))', cloud: 'var(--gs-cloud, var(--navy-line))', hill: 'var(--gs-hill, var(--sky))',
    moon: 'var(--gs-moon, var(--on-navy))', star: 'var(--gs-star, var(--on-navy))', deep: 'var(--gs-deep, var(--navy-2))'};
  const FLAT = {navy: '#101632', navy2: '#1D2550', navyLine: '#2F3870', cream: '#F7F5F0', lime: '#C8F169', pink: '#FF6FAE', sky: '#59C3FF', orange: '#FF9B45', violet: '#8C93FF'};
  const DARK = {...FLAT, muted: '#A9ACC8', cloud: '#2F3870', hill: '#59C3FF', moon: '#F7F5F0', star: '#F7F5F0', deep: '#1D2550'};
  const LIGHT = {...FLAT, muted: '#5A5F7B', cloud: '#C9CBE0', hill: '#1F8ACF', moon: '#FF9B45', star: '#8C93FF', deep: '#1D2550'};

  const hex = s => /^#[0-9a-f]{6}$/i.test(s);
  const fill = c => hex(c) ? `fill="${c}"` : `style="fill:${c}"`;
  const stroke = c => hex(c) ? `stroke="${c}"` : `style="stroke:${c}"`;

  // Flat style: solid fills only (no gradients, glows or see-through layers). Everything is drawn in a
  // 600 × 300 box placed at the bottom right of the 1200 × 320 view box; the rest stays transparent so the
  // card colour shows through.
  const ring = (c, x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" ${stroke(c)} stroke-width="2.4" stroke-dasharray="2 11" stroke-linecap="round"/>`;
  const sun = (c, x, y, r) => `<circle class="ms-sun gs-body" cx="${x}" cy="${y}" r="${r}" ${fill(c)}/>`;
  const sparkle = (c, x, y, r, cls) => { const q = +(r * .18).toFixed(2);
    return `<path${cls ? ` class="${cls}"` : ''} transform="translate(${x} ${y})" d="M0 -${r}Q${q} -${q} ${r} 0Q${q} ${q} 0 ${r}Q-${q} ${q} -${r} 0Q-${q} -${q} 0 -${r}Z" ${fill(c)}/>`; };
  const cloud = (c, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" ${fill(c)}><rect x="-40" y="0" width="92" height="22" rx="11"/><circle cx="-10" cy="2" r="17"/><circle cx="16" cy="-4" r="22"/></g>`;
  const birds = P => `<g fill="none" ${stroke(P.muted)} stroke-width="2.2" stroke-linecap="round"><path d="M330 120q7-7 14 0q7-7 14 0"/><path d="M372 96q6-6 12 0q6-6 12 0"/></g>`;
  const kite = P => `<g transform="translate(250 64) rotate(-12)"><path d="M0 -20L14 0L0 22L-14 0Z" ${fill(P.orange)}/><path d="M0 -20V22M-14 0H14" fill="none" ${stroke(P.navyLine)} stroke-width="1.6"/><path d="M0 22c-6 14 8 22 0 36s6 18 2 26" fill="none" ${stroke(P.muted)} stroke-width="1.6" stroke-linecap="round"/></g>`;
  const hillBack = c => `<path d="M90 300C170 238 300 214 410 240S560 222 600 214V300Z" ${fill(c)}/>`;
  const hillFront = c => `<path d="M0 300C110 270 250 258 370 276S530 262 600 268V300Z" ${fill(c)}/>`;
  const heart = c => `<path d="M560 70c-6-8-18-2-12 8l12 12 12-12c6-10-6-16-12-8z" ${fill(c)}/>`;
  // A crescent as one path (outer circle r 40, bitten by a circle r 36 up and to the right), so nothing is painted over the sky.
  const crescent = (c, x, y) => `<path class="ms-sun gs-body" transform="translate(${x} ${y})" d="M34.71 19.89A40 40 0 1 1 -5.01 -39.69A36 36 0 0 0 34.71 19.89Z" ${fill(c)}/>`;
  const STARS = [[330, 70, 7, 'lime'], [560, 150, 6, 'star'], [400, 150, 4, 'star'], [250, 120, 5, 'star'], [590, 50, 5, 'lime'], [180, 60, 4, 'star'], [520, 30, 4, 'star']];
  const stars = P => STARS.map(([x, y, r, c], i) => sparkle(P[c], x, y, r, 'gs-star').replace('/>', ` style="animation-delay:${(i % 5) * .6}s"/>`)).join('');

  function greetScene(period, id, P, opts) {
    P = P || VARS; id = id || 'gs'; opts = opts || {};
    const k = typeof period === 'string' ? period : period.k;
    const cls = opts.cls == null ? 'mscene gscene gs-' + k : opts.cls;
    const size = opts.size ? ` width="${opts.size[0]}" height="${opts.size[1]}"` : '';
    const open = `<svg ${cls ? `class="${cls}" ` : ''}xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"${size} preserveAspectRatio="xMaxYMax slice" aria-hidden="true">`;
    let body = '';
    if (k === 'morning') body = ring(P.orange, 470, 214, 84) + sun(P.orange, 470, 214, 58) + cloud(P.cloud, 330, 70, .9) + birds(P) + kite(P)
      + hillBack(P.hill) + hillFront(P.lime) + sparkle(P.lime, 560, 58, 9);
    else if (k === 'afternoon') body = ring(P.lime, 480, 92, 70) + sun(P.lime, 480, 92, 44) + cloud(P.cloud, 340, 120, 1) + cloud(P.cloud, 560, 170, .6) + kite(P)
      + hillBack(P.hill) + hillFront(P.orange) + sparkle(P.pink, 390, 46, 8);
    else if (k === 'evening') body = sun(P.pink, 460, 250, 78) + ring(P.pink, 460, 250, 104) + birds(P)
      + hillBack(P.violet) + hillFront(P.navyLine) + sparkle(P.orange, 300, 60, 8) + heart(P.pink);
    else body = crescent(P.moon, 470, 96) + stars(P) + hillBack(P.navyLine) + hillFront(P.deep);
    return `${open}\n  <g transform="translate(600 20)">${body}</g></svg>`;
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
