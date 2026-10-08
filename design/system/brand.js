/* Quad app design system: the school brand colour.
   One function turns any school colour into the brand tokens for light and dark, keeping WCAG AA:
     brand-fill / brand-ink   filled buttons, the active tab and badges; the ink is white when the colour can carry it
                              (3:1 or more before adjusting), otherwise navy, and the fill moves away from the ink until text is 4.5:1.
                              In dark mode a deep colour is first lifted until it stands out 3:1 from the card.
     brand-fill-strong        hover: the fill moved a little further from its ink (contrast only goes up).
     brand-text               the brand as text, links and icons: moved toward the ink colour until it is
                              4.5:1 on the canvas, cards, table headers and brand-soft.
     brand-soft               a tint for selected rows, chips and icon tiles; ink-3 captions stay 4.5:1 on it.
     rail-active / -ink       the active item in the navy side bar, lifted until it stands out 3:1 from the bar.
   It mirrors deriveBrand() in packages/tokens (see design/system.html#mapping). Works in the browser
   (window.QuadBrand) and in Node (module.exports) so the tests and the screenshots share it. */
(function (root) {
  const NAVY = '#101632', WHITE = '#FFFFFF', BLACK = '#000000';
  const BASE = {
    light: {surface: '#FFFFFF', canvas: '#F7F5F0', surface2: '#F0EEE7', rail: '#101632'},
    dark: {surface: '#171D45', canvas: '#0F1330', surface2: '#1D2550', rail: '#0A0D24'}
  };
  /** Colours older prototypes saved, mapped to the default. */
  const LEGACY = {'#2F6FED': null, '#A0412D': null};
  const DEFAULT = '#C8F169';

  const norm = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? '#' + m[1].toUpperCase() : null; };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = a => '#' + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  /** mix(a, share, b): a at `share`, b at 1 - share, per sRGB channel (CSS color-mix in srgb). */
  const mix = (a, share, b) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v * share + B[i] * (1 - share))); };
  const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  /** Moves `c` toward `target` one percent at a time until `ok` passes (or it reaches the target). */
  const toward = (c, target, ok) => { let f = c; for (let s = 1; !ok(f) && s > 0; s = Math.round((s - 0.01) * 100) / 100) f = mix(c, s, target); return ok(f) ? f : target; };
  /** White text when the colour is saturated enough to carry it (3:1 before adjusting), otherwise navy. */
  const inkFor = fill => contrast(fill, WHITE) >= 3 ? WHITE : NAVY;
  const awayFrom = ink => ink === WHITE ? BLACK : WHITE;
  const solid = (c, ink) => toward(c, awayFrom(ink), f => contrast(f, ink) >= 4.5);

  function deriveBrand(input, mode) {
    const m = mode === 'dark' ? 'dark' : 'light', b = BASE[m];
    let brand = norm(input) || DEFAULT; if (brand in LEGACY) brand = DEFAULT;
    const lift = m === 'dark' ? toward(brand, WHITE, f => contrast(f, b.surface) >= 3) : brand;
    const ink = inkFor(lift), fill = solid(lift, ink);
    const fillStrong = mix(fill, 0.86, awayFrom(ink));
    // The tint stays light (or dark) enough that captions in ink-3 still read 4.5:1 on a selected row.
    const ink3 = m === 'light' ? '#5A5F7B' : '#A9ACC8';
    let share = m === 'light' ? 0.16 : 0.2, soft = mix(brand, share, b.surface);
    while (contrast(ink3, soft) < 4.5 && share > 0.02) { share -= 0.01; soft = mix(brand, share, b.surface); }
    const textTarget = m === 'light' ? BLACK : WHITE;
    const text = toward(brand, textTarget, f => [b.surface, b.canvas, b.surface2, soft].every(bg => contrast(f, bg) >= 4.5));
    const railLift = toward(brand, WHITE, f => contrast(f, b.rail) >= 3);
    const railInk = inkFor(railLift), railActive = solid(railLift, railInk);
    return {brand, fill, ink, fillStrong, text, soft, railActive, railInk,
      checks: {ink: +contrast(fill, ink).toFixed(2), text: +Math.min(...[b.surface, b.canvas, b.surface2, soft].map(bg => contrast(text, bg))).toFixed(2), rail: +contrast(railActive, railInk).toFixed(2)}};
  }

  /** The CSS custom properties for one mode. Prototype names: --brand is the fill (buttons), --brand-text is for text. */
  function vars(d) {
    return `--brand:${d.fill};--brand-fill:${d.fill};--brand-ink:${d.ink};--brand-strong:${d.fillStrong};--brand-fill-strong:${d.fillStrong};` +
      `--brand-text:${d.text};--brand-soft:${d.soft};--brand-raw:${d.brand};--rail-active:${d.railActive};--rail-active-ink:${d.railInk};`;
  }

  /** Writes the brand tokens for both themes into one <style>, so switching theme needs no repaint call. */
  function applyBrand(input, doc) {
    doc = doc || root.document; if (!doc) return null;
    const L = deriveBrand(input, 'light'), D = deriveBrand(input, 'dark');
    let el = doc.getElementById('quad-brand');
    if (!el) { el = doc.createElement('style'); el.id = 'quad-brand'; doc.head.appendChild(el); }
    el.textContent = `:root{${vars(L)}}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${vars(D)}}}:root[data-theme="dark"]{${vars(D)}}`;
    return {light: L, dark: D};
  }

  const api = {deriveBrand, applyBrand, vars, contrast, mix, DEFAULT};
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QuadBrand = api;
})(typeof window !== 'undefined' ? window : globalThis);
