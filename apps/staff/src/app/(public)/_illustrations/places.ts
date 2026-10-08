/* Painted places and props shared by the landing page scenes (spec 19). */
import { ell, ln, pth, wv, type Pigment } from './paint';

/** Amaya's school: a white two-storey building with a clay-tile roof, a clock tower and a flag. */
export function wschool(x: number, y: number, s: number, extra = ''): string {
  let windows = '';
  for (const i of [-58, -42, -26, 26, 42, 58]) {
    windows +=
      pth(`M${i - 5} -4V-15A5 5 0 0 1 ${i + 5} -15V-4Z`, 'sky', 0.5, 'wcFig') +
      pth(`M${i - 4.5} -38h9v-9h-9Z`, 'sky', 0.45, 'wcFig');
  }
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    pth('M-72 0V-50H72V0Z', 'white', 0.95) +
    pth('M-72 0V-50H72V0Z', 'sky', 0.16) +
    pth('M20 0V-50H72V0Z', 'sky', 0.14) +
    ln('M-72 0V-50H72V0', 0.7, 0.3) +
    pth('M-80 -48L-64 -64H64L80 -48Z', 'roof', 0.7) +
    windows +
    pth('M-15 -50V-90H15V-50Z', 'white', 0.97) +
    pth('M3 -50V-90H15V-50Z', 'sky', 0.2) +
    ln('M-15 -50V-90H15V-50', 0.7, 0.3) +
    pth('M-21 -88L0 -104L21 -88Z', 'roof', 0.75) +
    `<circle cx="0" cy="-74" r="5.5" fill="none" stroke="${wv('charcoal')}" stroke-opacity=".5" stroke-width="1"/>` +
    pth('M-8 0V-20A8 8 0 0 1 8 -20V0Z', 'charcoal', 0.5, 'wcFig') +
    ln('M0 -104V-128', 1, 0.55) +
    pth('M1 -127Q8 -130 15 -126V-118Q8 -122 1 -119Z', 'rose', 0.8, 'wcFig') +
    ln('M-74 0H74', 0.8, 0.3) +
    extra +
    `</g>`
  );
}

/** A family home; a lit window means the family heard good news. */
export function whome(x: number, y: number, s: number, lit = true): string {
  const window = lit
    ? `<ellipse cx="22" cy="-21" rx="26" ry="20" fill="${wv('window')}" opacity=".35" filter="url(#wcBloom)"/>` +
      pth('M14 -29h16v14h-16Z', 'window', 0.95, 'wcFig')
    : pth('M14 -29h16v14h-16Z', 'sky', 0.5, 'wcFig');
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    pth('M-42 0V-40H42V0Z', 'white', 0.92) +
    pth('M-42 0V-40H42V0Z', 'ochre', 0.14) +
    pth('M10 0V-40H42V0Z', 'sky', 0.14) +
    ln('M-42 0V-40H42V0', 0.7, 0.3) +
    pth('M-52 -38L0 -72L52 -38Z', 'roof', 0.72) +
    window +
    ln('M22 -29v14M14 -22h16', 0.7, 0.45) +
    pth('M-16 0V-26H0V0Z', 'roof', 0.55, 'wcFig') +
    ln('M-44 0H44', 0.8, 0.3) +
    `</g>`
  );
}

export function wpalm(x: number, y: number, s: number, d: 1 | -1 = 1): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${s * d} ${s})">` +
    ln('M0 0C-3 -40 3 -82 14 -112', 2.6, 0.65) +
    pth('M14 -112Q-10 -126 -42 -100Q-12 -110 14 -112Z', 'olive', 0.7, 'wcFig') +
    pth('M14 -112Q40 -130 70 -104Q40 -112 14 -112Z', 'teal', 0.65, 'wcFig') +
    pth('M14 -112Q6 -140 26 -156Q22 -132 14 -112Z', 'olive', 0.6, 'wcFig') +
    pth('M14 -112Q-14 -110 -26 -80Q-8 -100 14 -112Z', 'teal', 0.55, 'wcFig') +
    pth('M14 -112Q40 -108 50 -78Q32 -100 14 -112Z', 'olive', 0.55, 'wcFig') +
    `</g>`
  );
}

export function wstupa(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">${pth('M-24 0A24 21 0 0 1 24 0Z', 'white', 0.92, 'wcFig')}${pth('M-6 -21h12v-7h-12Z M-2.4 -28L0 -50L2.4 -28Z', 'white', 0.92, 'wcFig')}${ln('M-26 0H26', 0.7, 0.35)}</g>`;
}

/** A Poya flag on its pole. */
export function wpoya(x: number, y: number, s: number): string {
  const stripes = (['sky', 'ochre', 'rose', 'white', 'apricot'] as const)
    .map(
      (c, i) =>
        `<rect x="${i * 6}" y="${(i % 2) * 0.8}" width="6.4" height="20" fill="${wv(c)}" fill-opacity=".85"/>`,
    )
    .join('');
  return (
    ln(`M${x} ${y}V${y - 70 * s}`, 1.1, 0.6) +
    `<g transform="translate(${x + 1} ${y - 68 * s}) scale(${s})" filter="url(#wcFig)">${stripes}</g>`
  );
}

/** A plank table or bench, with legs. */
export function plank(x: number, y: number, w: number, legs = true): string {
  return (
    pth(`M${x} ${y}h${w}v8h${-w}Z`, 'roof', 0.62, 'wcFig') +
    (legs ? ln(`M${x + 10} ${y + 8}v40M${x + w - 10} ${y + 8}v40`, 1.6, 0.5) : '')
  );
}

/** A sheet of paper or a card, with optional markup on it. */
export function paper(x: number, y: number, w: number, h: number, rot = 0, inner = ''): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${pth(`M0 0h${w}v${h}h${-w}Z`, 'white', 0.97, 'wcFig')}${pth(`M${w * 0.6} 0h${w * 0.4}v${h}h${-w * 0.4}Z`, 'sky', 0.1, 'wcFig')}${ln(`M0 0h${w}v${h}h${-w}Z`, 0.6, 0.3)}${inner}</g>`;
}

/** A steaming cup of tea. */
export function cup(x: number, y: number, c: Pigment = 'white', s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">${pth('M0 0h18v10q0 7 -7 7h-4q-7 0 -7 -7Z', c, 0.9, 'wcFig')}${ln('M18 3q6 0 6 4.5t-6 4.5', 1.2, 0.5)}${ln('M6 -4q-3 -5 0 -9M12 -4q-3 -5 0 -9', 0.8, 0.4)}</g>`;
}

export function wtree(x: number, y: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">${ln('M0 0C-1 -14 1 -26 0 -36', 3, 0.6)}${pth('M0 -70c-18 0 -28 12 -26 24c-10 4 -8 20 6 20h40c14 0 16 -16 6 -20c2 -12 -8 -24 -26 -24Z', 'olive', 0.7, 'wcFig')}${ell(8, -52, 12, 10, 'teal', 0.35, 'wcFig')}</g>`;
}

/** The school bus. */
export function wbus(x: number, y: number, s = 1): string {
  const windows = [8, 36, 64, 92]
    .map((i) => pth(`M${i} -44h22v16h-22Z`, 'sky', 0.55, 'wcFig'))
    .join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">${pth('M0 -52h120q14 0 16 12l4 26v10h-140Z', 'ochre', 0.92, 'wcFig')}${windows}${pth('M118 -44h14l4 16h-18Z', 'sky', 0.5, 'wcFig')}${ln('M0 -18H140', 2.4, 0.55, 'roof')}<circle cx="26" cy="-2" r="10" fill="${wv('charcoal')}" fill-opacity=".85"/><circle cx="112" cy="-2" r="10" fill="${wv('charcoal')}" fill-opacity=".85"/>${ln('M0 -52h120q14 0 16 12l4 26v10h-140Z', 0.6, 0.3)}</g>`;
}

/** A tuk-tuk. */
export function wtuk(x: number, y: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">${pth('M-38 -34Q-38 -58 -14 -58H32Q48 -58 52 -40L55 -34Z', 'sea', 0.8, 'wcFig')}${pth('M-42 -34H58Q64 -34 64 -26V-10H-42Z', 'roof', 0.78, 'wcFig')}${pth('M28 -52H42L49 -36H28Z', 'sky', 0.5, 'wcFig')}<circle cx="-22" cy="-6" r="8.5" fill="${wv('charcoal')}" fill-opacity=".85"/><circle cx="48" cy="-6" r="8.5" fill="${wv('charcoal')}" fill-opacity=".85"/>${ln('M-42 -34H58', 0.6, 0.35)}</g>`;
}

/** A sofa, split so people can sit between its back and its front. */
export function sofa(x: number, y: number, w: number, c: Pigment): { back: string; front: string } {
  return {
    back: pth(
      `M${x} ${y + 16}Q${x} ${y} ${x + 16} ${y}H${x + w - 16}Q${x + w} ${y} ${x + w} ${y + 16}V${y + 60}H${x}Z`,
      c,
      0.5,
      'wcMid',
    ),
    front:
      pth(`M${x - 8} ${y + 44}H${x + w + 8}V${y + 84}H${x - 8}Z`, c, 0.75, 'wcFig') +
      pth(`M${x - 14} ${y + 30}h16v54h-16Z M${x + w - 2} ${y + 30}h16v54h-16Z`, c, 0.82, 'wcFig'),
  };
}

/** A window frame over a painted view. */
export function wwin(x: number, y: number, w: number, h: number, view: string): string {
  return `${view}${ln(`M${x} ${y}h${w}v${h}h${-w}ZM${x + w / 2} ${y}v${h}`, 2, 0.5, 'roof')}`;
}

/** Amaya's canteen mural on a white board. */
export function mural(x: number, y: number, w: number, h: number): string {
  return (
    pth(`M${x} ${y}h${w}v${h}h${-w}Z`, 'white', 0.95, 'wcFig') +
    pth(
      `M${x} ${y + h * 0.62}q${w * 0.3} ${-h * 0.25} ${w * 0.55} ${-h * 0.05}t${w * 0.45} ${-h * 0.1}V${y + h}H${x}Z`,
      'teal',
      0.7,
      'wcFig',
    ) +
    `<circle cx="${x + w * 0.75}" cy="${y + h * 0.3}" r="${h * 0.14}" fill="${wv('roof')}" fill-opacity=".8"/>` +
    ln(`M${x} ${y}h${w}v${h}h${-w}Z`, 0.8, 0.45)
  );
}

/** A strip of ground along the bottom of a small scene. */
export function groundS(w: number, h: number): string {
  return pth(`M0 ${h - 18}Q${w / 2} ${h - 28} ${w} ${h - 18}V${h}H0Z`, 'olive', 0.3, 'wcMid');
}

/** The Quad mark, painted in its own colours (the only non-pigment colours in a scene). */
export function quadMark(
  x: number,
  y: number,
  s: number,
  school = 'var(--quad-mark-school)',
): string {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="9" y="9" width="21" height="21" rx="7" fill="${school}"/><rect x="34" y="9" width="21" height="21" rx="7" fill="var(--quad-mark-people)"/><rect x="9" y="34" width="21" height="21" rx="7" fill="var(--quad-mark-people)"/><rect x="34" y="34" width="21" height="21" rx="7" fill="var(--quad-mark-students)"/></g>`;
}
