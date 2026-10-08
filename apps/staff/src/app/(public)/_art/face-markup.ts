/*
 * The shared flat avatar (design/landing.html `face()`), as SVG markup: a role-coloured circle,
 * shoulders in the person's clothes, a head shaped per person with a darker side, hair with a
 * highlight, eyes with catchlights, brows, cheeks and a mouth for the mood. Pure and static, so a
 * server component renders it; every colour is a `site-*` token, darkened or lightened with
 * `color-mix`.
 */
import { PEOPLE, ROLE_COLOUR, site, type Look, type PersonId } from './people';

export type Mood = 'happy' | 'laugh' | 'worried';

/** The id of each person's head shape, defined once by `SiteArtDefs`. */
export const headClipId = (who: PersonId) => `site-head-${who}`;

const INK = site('navy');
const WHITE = site('white');
/** A darker tone of `colour` (shade), and a lighter one (shine). */
const dk = (colour: string, percent = 80) =>
  `color-mix(in srgb,${colour} ${percent}%,${site('shade')})`;
const lt = (colour: string, percent = 70) => `color-mix(in srgb,${colour} ${percent}%,${WHITE})`;
const shineOf = (colour: string) => lt(colour, 62);
const shadeOf = (colour: string) => dk(colour, 72);

/** How far each brow level tilts (`Look.brow`). */
const BROW_TILT = { 0: 0, 1: -0.8, 2: -1.6 } as const;

/** The vertical centre of every head. */
const CY = 47;

/** The head outline: a rounded top and a jaw as wide as `jaw` says. */
export function headPath(who: PersonId): string {
  const [w, h, j] = PEOPLE[who].head;
  const y0 = CY - h;
  const y1 = CY + h;
  return (
    `M50 ${y0}C${50 + w * 0.95} ${y0} ${50 + w} ${CY - h * 0.45} ${50 + w} ${CY + h * 0.05}` +
    `C${50 + w} ${CY + h * 0.55} ${50 + w * j} ${y1} 50 ${y1}` +
    `C${50 - w * j} ${y1} ${50 - w} ${CY + h * 0.55} ${50 - w} ${CY + h * 0.05}` +
    `C${50 - w} ${CY - h * 0.45} ${50 - w * 0.95} ${y0} 50 ${y0}Z`
  );
}

function clothes(p: Look): string {
  const top = site(p.top);
  let body =
    `<path d="M8 106Q10 80 50 77Q90 80 92 106Z" fill="${top}"/>` +
    `<path d="M50 77Q90 80 92 106H62Q66 90 50 77Z" fill="${shadeOf(top)}" opacity=".35"/>`;
  if (p.uniform)
    body +=
      `<path d="M8 106Q10 80 50 77Q90 80 92 106Z" fill="none" stroke="${site('cloth-line')}" stroke-width="1.2"/>` +
      `<path d="M38 78L50 90L62 78L58 76L50 84L42 76Z" fill="${WHITE}" stroke="${site('cloth-line-2')}" stroke-width="1"/>` +
      `<path d="M48 86h4l2 14-4 4-4-4Z" fill="${INK}"/>`;
  if (p.collar)
    body +=
      `<path d="M39 77L50 89L61 77L57 75L50 83L43 75Z" fill="${p.tie ? WHITE : lt(top, 55)}"/>` +
      (p.tie
        ? `<path d="M48 86h4l2 14-4 4-4-4Z" fill="${site(p.tie)}"/>`
        : `<path d="M50 89V106" stroke="${shadeOf(top)}" stroke-width="1.2" opacity=".5"/>`);
  if (p.jacket) {
    const trim = site('cloth-trim');
    body +=
      `<path d="M50 80V106" stroke="${trim}" stroke-width="2"/>` +
      `<path d="M42 78Q50 86 58 78" fill="none" stroke="${trim}" stroke-width="3"/>` +
      `<path d="M14 98L22 86M86 98L78 86" stroke="${trim}" stroke-width="2.5" opacity=".8"/>`;
  }
  if (p.scrubs)
    body +=
      `<path d="M41 77L50 92L59 77" fill="${dk(site(p.skin), 92)}"/>` +
      `<path d="M41 77L50 92L59 77" fill="none" stroke="${shadeOf(top)}" stroke-width="2.2"/>` +
      `<rect x="62" y="91" width="10" height="9" rx="1.5" fill="${shadeOf(top)}" opacity=".5"/>`;
  if (p.cardigan)
    body +=
      `<path d="M42 77L50 88L58 77Z" fill="${site('cloth-cream')}"/>` +
      `<path d="M8 106Q10 80 42 77L48 106Z M92 106Q90 80 58 77L52 106Z" fill="${site('orange')}"/>` +
      `<path d="M44 106L48 82M56 106L52 82" stroke="${dk(site('orange'), 80)}" stroke-width="1"/>`;
  if (p.necklace)
    body +=
      `<path d="M42 78Q50 88 58 78" fill="none" stroke="${site('butter')}" stroke-width="1.6"/>` +
      `<circle cx="50" cy="86" r="2" fill="${site('butter')}"/>`;
  if (p.staff)
    body +=
      `<path d="M40 79L47 99M60 79L53 99" stroke="${site(p.staff)}" stroke-width="2.4"/>` +
      `<rect x="45" y="97" width="10" height="9" rx="2" fill="${WHITE}"/>`;
  if (p.whistle)
    body +=
      `<path d="M42 79L49 95M58 79L51 95" stroke="${WHITE}" stroke-width="1.4"/>` +
      `<rect x="45.5" y="93" width="9" height="6" rx="3" fill="${site('butter')}"/>`;
  return body;
}

/** Hair behind the head, over the face (a beard, a hijab's wrap) and on top. */
function hair(p: Look): { back: string; over: string; front: string } {
  const hc = site(p.hair);
  const shine = (d: string, colour = hc) =>
    `<path d="${d}" fill="none" stroke="${shineOf(colour)}" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>`;
  switch (p.style) {
    case 'bun':
      return {
        back:
          `<circle cx="50" cy="17" r="9.5" fill="${hc}"/>` +
          `<path d="M43 13Q49 9 55 11" fill="none" stroke="${shineOf(hc)}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`,
        over: '',
        front:
          `<path d="M30 46Q29 23 50 23Q71 23 70 46Q64 31 52 31L50 27L48 31Q36 31 30 46Z" fill="${hc}"/>` +
          shine('M36 29Q42 25 47 25'),
      };
    case 'long':
      return {
        back:
          `<path d="M23 76Q17 22 50 21Q83 22 77 76Q70 70 70 52Q67 36 50 34Q33 36 30 52Q30 70 23 76Z" fill="${hc}"/>` +
          `<path d="M23 76Q19 60 24 44" fill="none" stroke="${shineOf(hc)}" stroke-width="2" opacity=".5"/>`,
        over: '',
        front:
          `<path d="M29 48Q27 21 52 22Q74 23 71 46Q63 30 44 33Q34 37 29 48Z" fill="${hc}"/>` +
          shine('M40 26Q50 23 60 27'),
      };
    case 'grandma':
      return {
        back:
          `<circle cx="50" cy="18" r="9" fill="${hc}"/>` +
          `<circle cx="52" cy="16" r="3" fill="${WHITE}" opacity=".7"/>`,
        over: '',
        front:
          `<path d="M29 46Q28 23 50 23Q72 23 71 46Q66 33 50 33Q34 33 29 46Z" fill="${hc}"/>` +
          `<path d="M34 34Q42 28 50 29M52 29Q60 28 66 34" fill="none" stroke="${dk(hc, 80)}" stroke-width="1.2" opacity=".6"/>` +
          shine('M37 28Q44 24 50 25', WHITE),
      };
    case 'cap': {
      const cap = site('orange');
      return {
        back: '',
        over: '',
        front:
          `<path d="M29 48Q28 36 33 33H67Q72 36 71 48Q67 41 50 41Q33 41 29 48Z" fill="${hc}"/>` +
          `<path d="M27 39Q28 15 50 15Q72 15 73 39Z" fill="${cap}"/>` +
          `<path d="M60 39Q72 15 50 15Q70 18 71 39Z" fill="${dk(cap, 82)}" opacity=".5"/>` +
          `<path d="M46 35H86Q88 35 87 39.5H46Z" fill="${dk(cap, 82)}"/>` +
          `<circle cx="50" cy="15.5" r="2.2" fill="${dk(cap, 70)}"/>` +
          shine('M35 26Q41 19 48 18', cap),
      };
    }
    case 'hijab':
      return {
        back:
          `<path d="M20 86Q14 22 50 19Q86 22 80 86Q66 92 50 92Q34 92 20 86Z" fill="${hc}"/>` +
          `<path d="M50 92Q66 92 80 86Q86 50 74 32Q82 58 72 82Z" fill="${dk(hc, 78)}" opacity=".6"/>`,
        over:
          `<path d="M26 48Q27 86 50 88Q73 86 74 48Q73 76 50 76Q27 76 26 48Z" fill="${hc}"/>` +
          `<path d="M50 88Q73 86 74 48Q73 76 58 78Z" fill="${dk(hc, 78)}" opacity=".6"/>`,
        front:
          `<path d="M28 46Q29 23 50 22Q71 23 72 46Q67 33 50 33Q33 33 28 46Z" fill="${hc}"/>` +
          `<path d="M28 44Q27 62 34 72" fill="none" stroke="${hc}" stroke-width="5" stroke-linecap="round"/>` +
          `<path d="M72 44Q73 62 66 72" fill="none" stroke="${hc}" stroke-width="5" stroke-linecap="round"/>` +
          shine('M36 27Q44 22 54 23'),
      };
    case 'beard':
      return {
        back: '',
        over:
          `<path d="M29 50Q30 75 50 76Q70 75 71 50Q68 62 60 63Q50 59 40 63Q32 62 29 50Z" fill="${hc}"/>` +
          `<path d="M41 60Q50 55 59 60Q50 58 41 60Z" fill="${hc}"/>` +
          `<path d="M60 63Q68 62 71 50Q70 70 58 74Z" fill="${dk(hc, 70)}" opacity=".5"/>`,
        front:
          `<path d="M29 44Q28 21 50 20Q73 20 71 42Q70 32 60 30Q50 25 40 30Q32 34 29 44Z" fill="${hc}"/>` +
          shine('M40 24Q50 20 60 24'),
      };
    case 'pigtails':
      return {
        back:
          `<circle cx="22" cy="50" r="9.5" fill="${hc}"/><circle cx="78" cy="50" r="9.5" fill="${hc}"/>` +
          `<circle cx="20" cy="47" r="2.6" fill="${shineOf(hc)}" opacity=".6"/>` +
          `<circle cx="76" cy="47" r="2.6" fill="${shineOf(hc)}" opacity=".6"/>`,
        over: '',
        front:
          `<path d="M29 46Q28 22 50 22Q72 22 71 46Q66 32 50 32Q34 32 29 46Z" fill="${hc}"/>` +
          shine('M37 28Q44 24 51 25') +
          `<circle cx="29" cy="44" r="3.4" fill="${site('pink')}"/><circle cx="71" cy="44" r="3.4" fill="${site('pink')}"/>` +
          `<circle cx="28" cy="43" r="1.1" fill="${WHITE}" opacity=".8"/><circle cx="70" cy="43" r="1.1" fill="${WHITE}" opacity=".8"/>`,
      };
    case 'curly': {
      const curls = [
        [27, 42, 8],
        [33, 30, 9],
        [42, 23, 9.5],
        [51, 21, 9.5],
        [60, 24, 9.5],
        [68, 31, 9],
        [73, 42, 8],
      ] as const;
      return {
        back: '',
        over: '',
        front:
          curls
            .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hc}"/>`)
            .join('') +
          `<circle cx="40" cy="21" r="2.4" fill="${shineOf(hc)}" opacity=".7"/>` +
          `<circle cx="52" cy="18" r="2" fill="${shineOf(hc)}" opacity=".7"/>` +
          `<circle cx="31" cy="28" r="1.8" fill="${shineOf(hc)}" opacity=".6"/>`,
      };
    }
    case 'short':
      return {
        back: '',
        over: '',
        front:
          `<path d="M29 44Q29 23 50 23Q71 23 71 44Q68 31 50 30Q32 31 29 44Z" fill="${hc}"/>` +
          `<path d="M29 44Q31 40 32 34M71 44Q69 40 68 34" stroke="${hc}" stroke-width="2.5"/>` +
          shine('M40 26Q50 23 60 26', site('shine-grey')),
      };
  }
}

/** Everything inside the face's round crop; `background` replaces the role colour. */
export function faceMarkup(who: PersonId, mood: Mood, background?: string): string {
  const p = PEOPLE[who];
  const [w, h] = p.head;
  const sk = site(p.skin);
  const hc = site(p.hair);
  const y0 = CY - h;
  const y1 = CY + h;
  const { back, over, front } = hair(p);

  const neck =
    `<path d="M43.5 ${y1 - 6}h13v${78 - y1 + 4}q-6.5 5 -13 0Z" fill="${dk(sk, 88)}"/>` +
    `<path d="M43.5 ${y1 - 6}h13v5q-6.5 4 -13 0Z" fill="${dk(sk, 72)}" opacity=".6"/>`;

  const ex = 8.5;
  const ey = CY + 2.5;
  const eyeRy = mood === 'worried' ? 2.6 : 3.4;
  const browY = ey - 7.5;
  const tilt = mood === 'worried' ? -2 : BROW_TILT[p.brow];
  const eye = (x: number) =>
    `<ellipse cx="${x}" cy="${ey}" rx="2.8" ry="${eyeRy}" fill="${INK}"/>` +
    `<circle cx="${x + 0.9}" cy="${ey - 1.2}" r=".95" fill="${WHITE}"/>`;

  let face =
    `<ellipse cx="${50 - w + 0.5}" cy="${CY + 3}" rx="3.4" ry="4.6" fill="${dk(sk, 88)}"/>` +
    `<ellipse cx="${50 + w - 0.5}" cy="${CY + 3}" rx="3.4" ry="4.6" fill="${dk(sk, 88)}"/>` +
    `<path d="${headPath(who)}" fill="${sk}"/>` +
    `<g clip-path="url(#${headClipId(who)})">` +
    `<ellipse cx="${50 + w * 1.05}" cy="${CY + 4}" rx="${w * 0.55}" ry="${h * 1.2}" fill="${dk(sk, 84)}" opacity=".55"/>` +
    `<ellipse cx="50" cy="${y0 + 9}" rx="${w * 0.95}" ry="6" fill="${dk(sk, 80)}" opacity=".28"/></g>`;
  if (p.ear)
    face +=
      `<circle cx="${50 - w + 0.5}" cy="${CY + 9}" r="1.8" fill="${site(p.ear)}"/>` +
      `<circle cx="${50 + w - 0.5}" cy="${CY + 9}" r="1.8" fill="${site(p.ear)}"/>`;
  face += `<g class="origin-center [transform-box:fill-box] motion-safe:animate-blink ${p.blink}">${eye(50 - ex)}${eye(50 + ex)}</g>`;
  const browColour = p.style === 'grandma' ? site('brow-grey') : dk(hc, 90);
  face +=
    mood === 'worried'
      ? `<path d="M37 ${browY + 2}L45 ${browY - 0.5}M63 ${browY + 2}L55 ${browY - 0.5}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="M${50 - ex - 3.5} ${browY - tilt}Q${50 - ex} ${browY - 2.2} ${50 - ex + 3.5} ${browY + tilt * 0.2}` +
        `M${50 + ex - 3.5} ${browY + tilt * 0.2}Q${50 + ex} ${browY - 2.2} ${50 + ex + 3.5} ${browY - tilt}" ` +
        `fill="none" stroke="${browColour}" stroke-width="1.6" stroke-linecap="round"/>`;
  face += `<path d="M50 ${ey + 3}Q48.6 ${ey + 7.5} 50.8 ${ey + 8}" fill="none" stroke="${dk(sk, 70)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
  face +=
    `<ellipse cx="36.5" cy="${ey + 8}" rx="4.4" ry="2.8" fill="${site('blush')}" opacity=".32"/>` +
    `<ellipse cx="63.5" cy="${ey + 8}" rx="4.4" ry="2.8" fill="${site('blush')}" opacity=".32"/>`;
  if (p.lines)
    face += `<path d="M${50 - ex - 5} ${ey + 1}l-2 1.5M${50 + ex + 5} ${ey + 1}l2 1.5" stroke="${dk(sk, 70)}" stroke-width=".9" stroke-linecap="round" opacity=".6"/>`;
  face += over;
  const my = ey + 10.5;
  if (mood === 'worried')
    face += `<path d="M44 ${my + 3}Q50 ${my - 1} 56 ${my + 3}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'laugh')
    face +=
      `<path d="M42 ${my - 1}Q50 ${my + 11} 58 ${my - 1}Z" fill="${INK}"/>` +
      `<path d="M45.5 ${my + 4.5}Q50 ${my + 2.5} 54.5 ${my + 4.5}Q50 ${my + 8} 45.5 ${my + 4.5}Z" fill="${site('blush')}"/>`;
  else
    face += `<path d="M43.5 ${my}Q50 ${my + 6.5} 56.5 ${my}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (p.glasses === 'round')
    face +=
      `<g stroke="${INK}" stroke-width="1.6" fill="${WHITE}" fill-opacity=".12"><circle cx="${50 - ex}" cy="${ey}" r="6"/><circle cx="${50 + ex}" cy="${ey}" r="6"/></g>` +
      `<path d="M${50 - ex + 6} ${ey}H${50 + ex - 6}" stroke="${INK}" stroke-width="1.6"/>`;
  if (p.glasses === 'square')
    face +=
      `<g stroke="${INK}" stroke-width="1.8" fill="${WHITE}" fill-opacity=".12"><rect x="${50 - ex - 6}" y="${ey - 4.5}" width="12" height="9" rx="2.5"/><rect x="${50 + ex - 6}" y="${ey - 4.5}" width="12" height="9" rx="2.5"/></g>` +
      `<path d="M${50 - ex + 6} ${ey - 1}H${50 + ex - 6}" stroke="${INK}" stroke-width="1.8"/>`;

  return (
    `<circle cx="50" cy="50" r="50" fill="${background ?? ROLE_COLOUR[p.role]}"/>` +
    `<circle cx="50" cy="50" r="50" fill="${WHITE}" opacity=".1" transform="translate(-18 -18) scale(.9)"/>` +
    back +
    clothes(p) +
    neck +
    face +
    front
  );
}
