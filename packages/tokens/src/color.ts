/** Small sRGB helpers shared by the brand derivation and the generators. */
const HEX = /^#?([0-9a-f]{6})$/i;

export function normalizeHex(hex: string): string {
  const m = HEX.exec(hex.trim());
  if (!m?.[1]) throw new RangeError(`Expected a 6-digit hex colour, got "${hex}"`);
  return `#${m[1].toUpperCase()}`;
}

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

/** `mix(a, 0.8, b)` is `a` at 80% and `b` at 20%, per sRGB channel (like CSS `color-mix(in srgb)`). */
export function mix(a: string, share: number, b: string): string {
  const ca = channels(a);
  const cb = channels(b);
  return toHex(ca.map((v, i) => v * share + (cb[i] ?? 0) * (1 - share)));
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
