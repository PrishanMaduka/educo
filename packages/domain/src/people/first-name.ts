/**
 * The name a greeting uses ("Good morning, Prishan"): the first word of the name that is not a
 * title or an initial (a word with a full stop, as the prototype's `rvMe` skips them), or the
 * first word when every word has one.
 */
export function firstNameOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.find((word) => !word.includes('.')) ?? words[0] ?? '';
}
