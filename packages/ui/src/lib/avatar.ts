/** Share of the colour token mixed over the surface for an avatar background. Text is always `text-ink`. */
export const AVATAR_TINT = 0.28;

export interface AvatarTone {
  /** Colour token name, as in `@quad/tokens` colours. */
  token: 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'good' | 'info';
  /** Full class string, written out so Tailwind can see it. */
  className: string;
}

/** Fixed palette. Each tint with ink text passes AA in light and dark (checked in avatar.test.ts). */
export const avatarPalette = [
  { token: 'c1', className: 'bg-c1/28 text-ink' },
  { token: 'c2', className: 'bg-c2/28 text-ink' },
  { token: 'c3', className: 'bg-c3/28 text-ink' },
  { token: 'c4', className: 'bg-c4/28 text-ink' },
  { token: 'c5', className: 'bg-c5/28 text-ink' },
  { token: 'good', className: 'bg-good/28 text-ink' },
  { token: 'info', className: 'bg-info/28 text-ink' },
] as const satisfies readonly AvatarTone[];

/** First letter of the first and last word, upper case. One word gives one letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letter = (word: string): string => Array.from(word)[0]?.toLocaleUpperCase() ?? '';
  return letter(first) + (last ? letter(last) : '');
}

/** FNV-1a, so the same name always lands on the same palette entry. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function avatarTone(name: string): AvatarTone {
  const key = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return avatarPalette[hash(key) % avatarPalette.length] ?? avatarPalette[0];
}
