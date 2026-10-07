'use client';

import { ToastProvider } from '@quad/ui';
import { useTranslation } from 'react-i18next';

import { STYLE_GUIDE } from './samples';
import { DESIGN_NS } from './strings';


import type { ReactNode } from 'react';

const THEMES = ['light', 'dark'] as const;

/**
 * The same sample in a light and a dark container. Each container sets data-theme, so the token CSS gives it
 * its own canvas and colours whatever the page's theme. Overlays (drawers, menus, tooltips) open in the page's
 * theme, because they render at the end of <body>.
 */
export function ThemePair({ name, children }: { name: string; children: () => ReactNode }) {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {THEMES.map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          role="group"
          aria-label={`${name}, ${t(theme)}`}
          className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-canvas p-5 text-ink max-sm:p-4"
        >
          <p className="m-0 text-[11px] font-extrabold tracking-[0.1em] text-ink-2 uppercase">
            {t(theme)}
          </p>
          <div className="min-w-0">{children()}</div>
        </div>
      ))}
    </div>
  );
}

/** One section per export of @quad/ui, headed by the export's name. */
export function StyleGuide() {
  return (
    <ToastProvider>
      <div className="flex flex-col gap-8">
        {STYLE_GUIDE.map(({ name, Sample }) => (
          <section
            key={name}
            id={name}
            aria-labelledby={`entry-${name}`}
            className="flex scroll-mt-6 flex-col gap-3"
          >
            <h2
              id={`entry-${name}`}
              className="m-0 font-mono text-lg font-bold tracking-[-0.01em] text-ink"
            >
              {name}
            </h2>
            <ThemePair name={name}>{() => <Sample />}</ThemePair>
          </section>
        ))}
      </div>
    </ToastProvider>
  );
}
