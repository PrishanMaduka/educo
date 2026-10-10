'use client';

import { ThemePair } from './StyleGuide';

/*
 * Colour tokens from @quad/tokens, each written out as a full class so Tailwind sees it. The names match the
 * token names in spec 03, so the swatch label is the token, not copy.
 */
const SWATCHES = [
  ['canvas', 'bg-canvas'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['line', 'bg-line'],
  ['line-strong', 'bg-line-strong'],
  ['ink', 'bg-ink'],
  ['ink-2', 'bg-ink-2'],
  ['ink-3', 'bg-ink-3'],
  ['brand', 'bg-brand'],
  ['brand-strong', 'bg-brand-strong'],
  ['brand-soft', 'bg-brand-soft'],
  ['brand-fill', 'bg-brand-fill'],
  ['brand-ink', 'bg-brand-ink'],
  ['brand-text', 'bg-brand-text'],
  ['brand-raw', 'bg-brand-raw'],
  ['gold', 'bg-gold'],
  ['gold-soft', 'bg-gold-soft'],
  ['good', 'bg-good'],
  ['good-soft', 'bg-good-soft'],
  ['warn', 'bg-warn'],
  ['warn-soft', 'bg-warn-soft'],
  ['bad', 'bg-bad'],
  ['bad-soft', 'bg-bad-soft'],
  ['info', 'bg-info'],
  ['info-soft', 'bg-info-soft'],
  ['rail', 'bg-rail'],
  ['rail-2', 'bg-rail-2'],
  ['rail-active', 'bg-rail-active'],
  ['rail-active-ink', 'bg-rail-active-ink'],
  ['surface-3', 'bg-surface-3'],
  ['field-line', 'bg-field-line'],
  ['switch-off', 'bg-switch-off'],
  ['focus', 'bg-focus'],
  ['navy', 'bg-navy'],
  ['navy-2', 'bg-navy-2'],
  ['navy-line', 'bg-navy-line'],
  ['navy-card', 'bg-navy-card'],
  ['on-navy', 'bg-on-navy'],
  ['inverse', 'bg-inverse'],
  ['on-fill', 'bg-on-fill'],
  ['lime', 'bg-lime'],
  ['lime-soft', 'bg-lime-soft'],
  ['lime-ink', 'bg-lime-ink'],
  ['pink', 'bg-pink'],
  ['pink-soft', 'bg-pink-soft'],
  ['pink-ink', 'bg-pink-ink'],
  ['sky', 'bg-sky'],
  ['sky-soft', 'bg-sky-soft'],
  ['sky-ink', 'bg-sky-ink'],
  ['orange', 'bg-orange'],
  ['orange-soft', 'bg-orange-soft'],
  ['orange-ink', 'bg-orange-ink'],
  ['heat-0', 'bg-heat-0'],
  ['heat-1', 'bg-heat-1'],
  ['heat-2', 'bg-heat-2'],
  ['heat-3', 'bg-heat-3'],
  ['nav-lime', 'bg-nav-lime'],
  ['nav-orange', 'bg-nav-orange'],
  ['nav-pink', 'bg-nav-pink'],
  ['nav-sky', 'bg-nav-sky'],
  ['nav-violet', 'bg-nav-violet'],
  ['nav-mist', 'bg-nav-mist'],
  ['c1', 'bg-c1'],
  ['c2', 'bg-c2'],
  ['c3', 'bg-c3'],
  ['c4', 'bg-c4'],
  ['c5', 'bg-c5'],
] as const;

export function TokenSwatches({ title }: { title: string }) {
  return (
    <ThemePair name={title}>
      {() => (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 p-0">
          {SWATCHES.map(([token, className]) => (
            <li key={token} className="flex min-w-0 flex-col gap-1.5">
              <span
                aria-hidden="true"
                className={`h-11 rounded-lg border border-line shadow-card ${className}`}
              />
              <code className="truncate text-xs font-semibold text-ink">{token}</code>
            </li>
          ))}
        </ul>
      )}
    </ThemePair>
  );
}
