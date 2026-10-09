/* Quad app design system: flat illustrated people and doodles, shared by design/system.html and the app prototypes.
   Ported from design/landing.html (same cast and drawing), without the blinking.
   Use the illustrated faces for the sample cast, onboarding and empty states only. Real people get a photo or
   initials (initials() below): Quad never guesses what a real child or parent looks like.
   Colours: role backgrounds and clothes use the accent tokens (--sky, --lime, --pink, --orange, --navy); skin, hair
   and a few art tones are fixed hex values inside the art. */
(function (root) {
  const ROLE = {teach: 'var(--sky)', care: 'var(--lime)', home: 'var(--pink)', child: 'var(--orange)'};
  const PEEPS = {
    okafor: {name: 'Ms. Okafor', role: 'teach', skin: '#8d5a3b', hair: '#1a1210', hs: 'bun', head: [20, 24, .5], top: '#1f3a8a', staff: 'var(--lime)', ear: '#FFE680', brow: 2},
    tanaka: {name: 'Coach Tanaka', role: 'care', skin: '#f1c7a3', hair: '#1a1210', hs: 'cap', head: [21, 22, .82], top: '#26318a', jacket: 1, whistle: 1, brow: 0},
    haddad: {name: 'Nurse Haddad', role: 'care', skin: '#c98d62', hair: '#6d2f5c', hs: 'hijab', head: [19, 23, .55], top: '#1f9e8f', scrubs: 1, staff: 'var(--sky)', brow: 1},
    priya: {name: 'Priya, Mum', role: 'home', skin: '#b57a52', hair: '#1a1210', hs: 'long', head: [19.5, 23, .42], top: '#2f55d4', necklace: 1, ear: '#FFE680', brow: 2},
    asha: {name: 'Nani Asha', role: 'home', skin: '#a8714b', hair: '#e4e0d8', hs: 'grandma', head: [22, 22, .75], top: '#8a2a4a', cardigan: 1, glasses: 'round', lines: 1, brow: 1},
    daniel: {name: 'Daniel, Dad', role: 'home', skin: '#e9b48a', hair: '#6b4226', hs: 'beard', head: [20, 24, .78], top: '#3a7bd5', collar: 1, brow: 0},
    maya: {name: 'Maya', role: 'child', skin: '#b57a52', hair: '#1a1210', hs: 'pigtails', head: [22, 21, .7], top: '#ffffff', uniform: 1, brow: 1},
    leo: {name: 'Leo', role: 'teach', skin: '#e9b48a', hair: '#3a2516', hs: 'curly', head: [21, 22, .72], top: '#ffffff', uniform: 1, brow: 1},
    abara: {name: 'Mr. Abara', role: 'teach', skin: '#6e4429', hair: '#1a1210', hs: 'short', head: [21, 24, .85], top: '#ffffff', collar: 1, tie: '#1d2550', staff: 'var(--orange)', glasses: 'square', brow: 0}
  };
  const INK = 'var(--navy)';
  const dk = (c, p = 80) => `color-mix(in srgb,${c} ${p}%,#1b0f0c)`, lt = (c, p = 70) => `color-mix(in srgb,${c} ${p}%,#ffffff)`;
  let fid = 0;
  /* One shared avatar: flat shapes with a second, darker tone for shadow and a lighter one for highlights */
  function face(id, o = {}) {
    const p = PEEPS[id], mood = o.mood || 'happy', uid = 'fc' + (++fid), hc = p.hair, sk = p.skin, [w, h, j] = p.head, cy = 47;
    const y0 = cy - h, y1 = cy + h;
    const head = `M50 ${y0}C${50 + w * .95} ${y0} ${50 + w} ${cy - h * .45} ${50 + w} ${cy + h * .05}C${50 + w} ${cy + h * .55} ${50 + w * j} ${y1} 50 ${y1}C${50 - w * j} ${y1} ${50 - w} ${cy + h * .55} ${50 - w} ${cy + h * .05}C${50 - w} ${cy - h * .45} ${50 - w * .95} ${y0} 50 ${y0}Z`;
    const H = c => lt(c, 62), S = c => dk(c, 72);
    // clothes: shoulders with a shadow side, then the details
    let body = `<path d="M8 106Q10 80 50 77Q90 80 92 106Z" fill="${p.top}"/><path d="M50 77Q90 80 92 106H62Q66 90 50 77Z" fill="${S(p.top)}" opacity=".35"/>`;
    if (p.uniform) body += `<path d="M8 106Q10 80 50 77Q90 80 92 106Z" fill="none" stroke="#d6dbe8" stroke-width="1.2"/><path d="M38 78L50 90L62 78L58 76L50 84L42 76Z" fill="#fff" stroke="#c9d0e0" stroke-width="1"/><path d="M48 86h4l2 14-4 4-4-4Z" fill="var(--navy)"/>`;
    if (p.collar) body += `<path d="M39 77L50 89L61 77L57 75L50 83L43 75Z" fill="${p.tie ? '#fff' : lt(p.top, 55)}"/>` + (p.tie ? `<path d="M48 86h4l2 14-4 4-4-4Z" fill="${p.tie}"/>` : `<path d="M50 89V106" stroke="${S(p.top)}" stroke-width="1.2" opacity=".5"/>`);
    if (p.jacket) body += `<path d="M50 80V106" stroke="#e8ecff" stroke-width="2"/><path d="M42 78Q50 86 58 78" fill="none" stroke="#e8ecff" stroke-width="3"/><path d="M14 98L22 86M86 98L78 86" stroke="#e8ecff" stroke-width="2.5" opacity=".8"/>`;
    if (p.scrubs) body += `<path d="M41 77L50 92L59 77" fill="${dk(sk, 92)}"/><path d="M41 77L50 92L59 77" fill="none" stroke="${S(p.top)}" stroke-width="2.2"/><rect x="62" y="91" width="10" height="9" rx="1.5" fill="${S(p.top)}" opacity=".5"/>`;
    if (p.cardigan) body += `<path d="M42 77L50 88L58 77Z" fill="#f3e6d0"/><path d="M8 106Q10 80 42 77L48 106Z M92 106Q90 80 58 77L52 106Z" fill="var(--orange)"/><path d="M44 106L48 82M56 106L52 82" stroke="${dk('#f29b45', 80)}" stroke-width="1"/>`;
    if (p.necklace) body += `<path d="M42 78Q50 88 58 78" fill="none" stroke="#FFE680" stroke-width="1.6"/><circle cx="50" cy="86" r="2" fill="#FFE680"/>`;
    if (p.staff) body += `<path d="M40 79L47 99M60 79L53 99" stroke="${p.staff}" stroke-width="2.4"/><rect x="45" y="97" width="10" height="9" rx="2" fill="#fff"/>`;
    if (p.whistle) body += `<path d="M42 79L49 95M58 79L51 95" stroke="#fff" stroke-width="1.4"/><rect x="45.5" y="93" width="9" height="6" rx="3" fill="#FFE680"/>`;
    const neck = `<path d="M43.5 ${y1 - 6}h13v${78 - y1 + 4}q-6.5 5 -13 0Z" fill="${dk(sk, 88)}"/><path d="M43.5 ${y1 - 6}h13v5q-6.5 4 -13 0Z" fill="${dk(sk, 72)}" opacity=".6"/>`;
    // hair behind the head
    let back = '', front = '', over = '';
    const fringe = `<path d="M29 46Q28 22 50 22Q72 22 71 46Q66 32 50 32Q34 32 29 46Z" fill="${hc}"/>`;
    const shine = (d, c = hc) => `<path d="${d}" fill="none" stroke="${H(c)}" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>`;
    if (p.hs === 'bun') { back = `<circle cx="50" cy="17" r="9.5" fill="${hc}"/><path d="M43 13Q49 9 55 11" fill="none" stroke="${H(hc)}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`; front = `<path d="M30 46Q29 23 50 23Q71 23 70 46Q64 31 52 31L50 27L48 31Q36 31 30 46Z" fill="${hc}"/>` + shine('M36 29Q42 25 47 25'); }
    if (p.hs === 'long') { back = `<path d="M23 76Q17 22 50 21Q83 22 77 76Q70 70 70 52Q67 36 50 34Q33 36 30 52Q30 70 23 76Z" fill="${hc}"/><path d="M23 76Q19 60 24 44" fill="none" stroke="${H(hc)}" stroke-width="2" opacity=".5"/>`; front = `<path d="M29 48Q27 21 52 22Q74 23 71 46Q63 30 44 33Q34 37 29 48Z" fill="${hc}"/>` + shine('M40 26Q50 23 60 27'); }
    if (p.hs === 'grandma') { back = `<circle cx="50" cy="18" r="9" fill="${hc}"/><circle cx="52" cy="16" r="3" fill="#fff" opacity=".7"/>`; front = `<path d="M29 46Q28 23 50 23Q72 23 71 46Q66 33 50 33Q34 33 29 46Z" fill="${hc}"/><path d="M34 34Q42 28 50 29M52 29Q60 28 66 34" fill="none" stroke="${dk(hc, 80)}" stroke-width="1.2" opacity=".6"/>` + shine('M37 28Q44 24 50 25', '#ffffff'); }
    if (p.hs === 'cap') { front = `<path d="M29 48Q28 36 33 33H67Q72 36 71 48Q67 41 50 41Q33 41 29 48Z" fill="${hc}"/><path d="M27 39Q28 15 50 15Q72 15 73 39Z" fill="var(--orange)"/><path d="M60 39Q72 15 50 15Q70 18 71 39Z" fill="${dk('#ff9b45', 82)}" opacity=".5"/><path d="M46 35H86Q88 35 87 39.5H46Z" fill="${dk('#ff9b45', 82)}"/><circle cx="50" cy="15.5" r="2.2" fill="${dk('#ff9b45', 70)}"/>` + shine('M35 26Q41 19 48 18', '#ff9b45'); }
    if (p.hs === 'hijab') { back = `<path d="M20 86Q14 22 50 19Q86 22 80 86Q66 92 50 92Q34 92 20 86Z" fill="${hc}"/><path d="M50 92Q66 92 80 86Q86 50 74 32Q82 58 72 82Z" fill="${dk(hc, 78)}" opacity=".6"/>`; over = `<path d="M26 48Q27 86 50 88Q73 86 74 48Q73 76 50 76Q27 76 26 48Z" fill="${hc}"/><path d="M50 88Q73 86 74 48Q73 76 58 78Z" fill="${dk(hc, 78)}" opacity=".6"/>`; front = `<path d="M28 46Q29 23 50 22Q71 23 72 46Q67 33 50 33Q33 33 28 46Z" fill="${hc}"/><path d="M28 44Q27 62 34 72" fill="none" stroke="${hc}" stroke-width="5" stroke-linecap="round"/><path d="M72 44Q73 62 66 72" fill="none" stroke="${hc}" stroke-width="5" stroke-linecap="round"/>` + shine('M36 27Q44 22 54 23', hc); }
    if (p.hs === 'beard') { front = `<path d="M29 44Q28 21 50 20Q73 20 71 42Q70 32 60 30Q50 25 40 30Q32 34 29 44Z" fill="${hc}"/>` + shine('M40 24Q50 20 60 24'); over = `<path d="M29 50Q30 75 50 76Q70 75 71 50Q68 62 60 63Q50 59 40 63Q32 62 29 50Z" fill="${hc}"/><path d="M41 60Q50 55 59 60Q50 58 41 60Z" fill="${hc}"/><path d="M60 63Q68 62 71 50Q70 70 58 74Z" fill="${dk(hc, 70)}" opacity=".5"/>`; }
    if (p.hs === 'pigtails') { back = `<circle cx="22" cy="50" r="9.5" fill="${hc}"/><circle cx="78" cy="50" r="9.5" fill="${hc}"/><circle cx="20" cy="47" r="2.6" fill="${H(hc)}" opacity=".6"/><circle cx="76" cy="47" r="2.6" fill="${H(hc)}" opacity=".6"/>`; front = fringe + shine('M37 28Q44 24 51 25') + `<circle cx="29" cy="44" r="3.4" fill="var(--pink)"/><circle cx="71" cy="44" r="3.4" fill="var(--pink)"/><circle cx="28" cy="43" r="1.1" fill="#fff" opacity=".8"/><circle cx="70" cy="43" r="1.1" fill="#fff" opacity=".8"/>`; }
    if (p.hs === 'curly') { front = [27, 33, 42, 51, 60, 68, 73].map((cx, i) => `<circle cx="${cx}" cy="${[42, 30, 23, 21, 24, 31, 42][i]}" r="${[8, 9, 9.5, 9.5, 9.5, 9, 8][i]}" fill="${hc}"/>`).join('') + `<circle cx="40" cy="21" r="2.4" fill="${H(hc)}" opacity=".7"/><circle cx="52" cy="18" r="2" fill="${H(hc)}" opacity=".7"/><circle cx="31" cy="28" r="1.8" fill="${H(hc)}" opacity=".6"/>`; }
    if (p.hs === 'short') { front = `<path d="M29 44Q29 23 50 23Q71 23 71 44Q68 31 50 30Q32 31 29 44Z" fill="${hc}"/><path d="M29 44Q31 40 32 34M71 44Q69 40 68 34" stroke="${hc}" stroke-width="2.5"/>` + shine('M40 26Q50 23 60 26', '#555'); }
    // face: shadow side, ears, eyes with catchlights, brows, soft cheeks, mouth
    const ex = 8.5, ey = cy + 2.5, ery = mood === 'worried' ? 2.6 : 3.4;
    const browY = ey - 7.5, tilt = mood === 'worried' ? -2 : [0, -.8, -1.6][p.brow];
    let fc = `<ellipse cx="${50 - w + .5}" cy="${cy + 3}" rx="3.4" ry="4.6" fill="${dk(sk, 88)}"/><ellipse cx="${50 + w - .5}" cy="${cy + 3}" rx="3.4" ry="4.6" fill="${dk(sk, 88)}"/>`
      + `<path d="${head}" fill="${sk}"/><clipPath id="${uid}h"><path d="${head}"/></clipPath><g clip-path="url(#${uid}h)"><ellipse cx="${50 + w * 1.05}" cy="${cy + 4}" rx="${w * .55}" ry="${h * 1.2}" fill="${dk(sk, 84)}" opacity=".55"/><ellipse cx="50" cy="${y0 + 9}" rx="${w * .95}" ry="6" fill="${dk(sk, 80)}" opacity=".28"/></g>`;
    if (p.ear) fc += `<circle cx="${50 - w + .5}" cy="${cy + 9}" r="1.8" fill="${p.ear}"/><circle cx="${50 + w - .5}" cy="${cy + 9}" r="1.8" fill="${p.ear}"/>`;
    const eye = x => `<ellipse cx="${x}" cy="${ey}" rx="2.8" ry="${ery}" fill="${INK}"/><circle cx="${x + .9}" cy="${ey - 1.2}" r=".95" fill="#fff"/>`;
    fc += `${eye(50 - ex)}${eye(50 + ex)}`;
    fc += mood === 'worried' ? `<path d="M37 ${browY + 2}L45 ${browY - .5}M63 ${browY + 2}L55 ${browY - .5}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="M${50 - ex - 3.5} ${browY - tilt}Q${50 - ex} ${browY - 2.2} ${50 - ex + 3.5} ${browY + tilt * .2}M${50 + ex - 3.5} ${browY + tilt * .2}Q${50 + ex} ${browY - 2.2} ${50 + ex + 3.5} ${browY - tilt}" fill="none" stroke="${p.hs === 'grandma' ? '#8d8a86' : dk(hc === '#e4e0d8' ? '#555' : hc, 90)}" stroke-width="1.6" stroke-linecap="round"/>`;
    fc += `<path d="M50 ${ey + 3}Q48.6 ${ey + 7.5} 50.8 ${ey + 8}" fill="none" stroke="${dk(sk, 70)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
    fc += `<ellipse cx="${50 - 13.5}" cy="${ey + 8}" rx="4.4" ry="2.8" fill="#FF7F9C" opacity=".32"/><ellipse cx="${50 + 13.5}" cy="${ey + 8}" rx="4.4" ry="2.8" fill="#FF7F9C" opacity=".32"/>`;
    if (p.lines) fc += `<path d="M${50 - ex - 5} ${ey + 1}l-2 1.5M${50 + ex + 5} ${ey + 1}l2 1.5" stroke="${dk(sk, 70)}" stroke-width=".9" stroke-linecap="round" opacity=".6"/>`;
    fc += over; over = '';
    const my = ey + 10.5;
    fc += mood === 'worried' ? `<path d="M44 ${my + 3}Q50 ${my - 1} 56 ${my + 3}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      : mood === 'laugh' ? `<path d="M42 ${my - 1}Q50 ${my + 11} 58 ${my - 1}Z" fill="${INK}"/><path d="M45.5 ${my + 4.5}Q50 ${my + 2.5} 54.5 ${my + 4.5}Q50 ${my + 8} 45.5 ${my + 4.5}Z" fill="#FF7F9C"/>`
      : `<path d="M43.5 ${my}Q50 ${my + 6.5} 56.5 ${my}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    if (p.glasses === 'round') fc += `<g stroke="${INK}" stroke-width="1.6" fill="#fff" fill-opacity=".12"><circle cx="${50 - ex}" cy="${ey}" r="6"/><circle cx="${50 + ex}" cy="${ey}" r="6"/></g><path d="M${50 - ex + 6} ${ey}H${50 + ex - 6}" stroke="${INK}" stroke-width="1.6"/>`;
    if (p.glasses === 'square') fc += `<g stroke="${INK}" stroke-width="1.8" fill="#fff" fill-opacity=".12"><rect x="${50 - ex - 6}" y="${ey - 4.5}" width="12" height="9" rx="2.5"/><rect x="${50 + ex - 6}" y="${ey - 4.5}" width="12" height="9" rx="2.5"/></g><path d="M${50 - ex + 6} ${ey - 1}H${50 + ex - 6}" stroke="${INK}" stroke-width="1.8"/>`;
    const pos = o.size ? ` x="${o.x}" y="${o.y}" width="${o.size}" height="${o.size}"` : ' width="100%" height="100%"';
    return `<svg viewBox="0 0 100 100"${pos} aria-hidden="true" focusable="false" style="display:block;overflow:visible"><defs><clipPath id="${uid}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${uid})">`
      + `<circle cx="50" cy="50" r="50" fill="${o.bg || ROLE[p.role]}"/><circle cx="50" cy="50" r="50" fill="#fff" opacity=".1" transform="translate(-18 -18) scale(.9)"/>${back}${body}${neck}${fc}${over}${front}</g></svg>`;
  }
  const SH = {
    star: c => `<polygon points="20,2 25,14.5 38.5,15 28,23.5 31.5,37 20,29.5 8.5,37 12,23.5 1.5,15 15,14.5" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`,
    heart: c => `<path d="M20 35 C 6 25 2 16 8 10 C 13 5 19 8 20 12 C 21 8 27 5 32 10 C 38 16 34 25 20 35Z" fill="${c}"/>`,
    sun: c => `<circle cx="20" cy="20" r="8" fill="${c}"/><g stroke="${c}" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${20 + 12 * Math.cos(r)}" y1="${20 + 12 * Math.sin(r)}" x2="${20 + 17 * Math.cos(r)}" y2="${20 + 17 * Math.sin(r)}"/>`; }).join('')}</g>`,
    squiggle: c => `<path d="M2 20 Q 8 8 14 20 T 26 20 T 38 20" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    kite: c => `<polygon points="20,1 33,15 20,28 7,15" fill="${c}"/><path d="M20 1 V28 M7 15 H33" stroke="${INK}" stroke-opacity=".25" stroke-width="1.5"/><path d="M20 28 Q 14 32 20 35 T 18 40" stroke="${c}" stroke-width="2" fill="none"/>`,
    plane: c => `<polygon points="2,18 38,4 26,36 19,24" fill="${c}"/><path d="M19 24 L38 4" stroke="${INK}" stroke-opacity=".25" stroke-width="1.5"/>`,
    pencil: c => `<polygon points="9,27 27,9 33,15 15,33" fill="${c}"/><polygon points="9,27 15,33 4,38" fill="#F1C7A3"/><polygon points="27,9 30,6 36,12 33,15" fill="var(--pink)"/>`,
    book: c => `<path d="M3 10 Q11 5 20 10 L20 35 Q11 30 3 35Z" fill="${c}"/><path d="M37 10 Q29 5 20 10 L20 35 Q29 30 37 35Z" fill="${c}" opacity=".75"/>`,
    cloud: c => `<path d="M10 31 Q2 31 4 23 Q6 16 14 18 Q16 8 25 10 Q34 10 33 19 Q40 20 38 27 Q37 31 30 31Z" fill="${c}"/>`,
    coin: c => `<circle cx="20" cy="20" r="15" fill="${c}"/><circle cx="20" cy="20" r="9.5" fill="none" stroke="${INK}" stroke-opacity=".3" stroke-width="2"/>`,
    bubble: c => `<path d="M6 6 H34 Q38 6 38 10 V25 Q38 29 34 29 H18 L10 37 L12 29 H6 Q2 29 2 25 V10 Q2 6 6 6Z" fill="${c}"/>`,
    moon: c => `<path d="M24 3 A17 17 0 1 0 37 29 A13 13 0 1 1 24 3Z" fill="${c}"/>`
  };
  const doodle = (k, c, o = {}) => `<svg viewBox="0 0 40 40"${o.size ? ` width="${o.size}" height="${o.size}"` : ''}${o.x != null ? ` x="${o.x}" y="${o.y}"` : ''} aria-hidden="true" focusable="false" style="overflow:visible"><g${o.anim ? ` class="anim" style="animation:${o.anim}"` : ''}>${SH[k](c)}</g></svg>`;

  /* Initials avatar for real people: a flat accent circle with navy initials (6.8:1 or more on every accent). */
  const TONES = ['var(--sky)', 'var(--pink)', 'var(--lime)', 'var(--orange)'];
  function initials(name, o = {}) {
    const n = String(name || '').replace(/^(Mr|Mrs|Ms|Miss|Dr|Coach|Nurse)\.?\s+/i, '').trim();
    const t = n.split(/\s+/).filter(Boolean), txt = ((t[0] || '?')[0] + (t.length > 1 ? t[t.length - 1][0] : '')).toUpperCase();
    let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const bg = o.bg || TONES[h % TONES.length];
    return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" style="display:block"><circle cx="50" cy="50" r="50" fill="${bg}"/><circle cx="50" cy="50" r="50" fill="#fff" opacity=".12" transform="translate(-18 -18) scale(.9)"/><text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Bricolage Grotesque, Figtree, sans-serif" font-weight="800" font-size="${txt.length > 1 ? 38 : 44}" letter-spacing="-1" fill="var(--navy)">${txt}</text></svg>`;
  }
  root.QuadFaces = {face, doodle, initials, PEEPS, ROLE, SH};
})(window);
