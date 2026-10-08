import { SLOT_MARKER, splitAround } from '@/i18n';

/**
 * A translated heading with one word on a tilted accent pill, for example "Every child has a
 * (circle)." `template` is the message translated with `{ accent: SLOT_MARKER }`. Punctuation
 * right after the word stays on its line. Screen readers get the plain sentence (the tilted pill
 * is an inline block, which would otherwise split the word from its full stop).
 */
export function Highlighted({ template, accent }: { template: string; accent: string }) {
  const [before, after] = splitAround(template, SLOT_MARKER);
  const punctuation = /^[.,!?]*/.exec(after)?.[0] ?? '';
  return (
    <>
      <span className="sr-only">{`${before}${accent}${after}`}</span>
      <span aria-hidden="true">
        {before}
        <span className="whitespace-nowrap">
          <span className="inline-block rotate-[-2deg] rounded-[.5em] bg-site-accent px-[.18em] pb-[.06em] text-site-on-vivid">
            {accent}
          </span>
          {punctuation}
        </span>
        {after.slice(punctuation.length)}
      </span>
    </>
  );
}
