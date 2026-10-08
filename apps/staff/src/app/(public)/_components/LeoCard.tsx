'use client';

import { cn } from '@quad/ui';
import { useEffect, useRef, useState } from 'react';

import { leoBars, type BarTone } from '../_lib/leo';
import { usePrefersReducedMotion } from '../_lib/reduced-motion';

import { focusRing } from './styles';

import type { ReactNode } from 'react';

export interface LeoCardText {
  name: string;
  detail: string;
  tagBefore: string;
  tagAfter: string;
  textBefore: string;
  textAfter: string;
  teacher: string;
  teacherRole: string;
  start: string;
  replay: string;
}

const TONE: Record<BarTone, string> = {
  steady: 'bg-site-bar-ink',
  down: 'bg-site-alert',
  up: 'bg-site-pine',
};

/**
 * Leo's card (spec 19 "Wellbeing, early"): his History slipping, and a support plan that brings
 * it back. The button reports `aria-pressed`; the sentence under the chart is a polite live region.
 * The bars grow when the card comes into view, except with reduced motion.
 */
export function LeoCard({
  text,
  faces,
}: {
  text: LeoCardText;
  faces: { worried: ReactNode; happy: ReactNode; teacher: ReactNode };
}) {
  const [planned, setPlanned] = useState(false);
  const [isSeen, setSeen] = useState(true);
  const reduced = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (reduced || !card || !('IntersectionObserver' in window)) return undefined;
    setSeen(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(card);
    return () => {
      observer.disconnect();
    };
  }, [reduced]);

  return (
    <div
      ref={cardRef}
      className="flex max-w-[500px] flex-[1_1_360px] flex-col gap-4 rounded-[32px] bg-site-sheet-bg p-[clamp(22px,3vw,32px)] text-site-sheet-ink shadow-[0_30px_70px_var(--quad-site-card-shadow)]"
    >
      <div className="flex items-center gap-3.5">
        <div className="size-[76px] flex-none">{planned ? faces.happy : faces.worried}</div>
        <div>
          <b className="block text-2xl leading-none font-extrabold tracking-[-.02em]">
            {text.name}
          </b>
          <small className="mt-1 block text-[13px] text-site-sheet-ink-2">{text.detail}</small>
        </div>
        <span
          className={cn(
            'ml-auto rounded-full px-3 py-1.5 text-[13px] font-bold',
            planned
              ? 'bg-site-tag-good-bg text-site-tag-good-ink'
              : 'bg-site-tag-bad-bg text-site-tag-bad-ink',
          )}
        >
          {planned ? text.tagAfter : text.tagBefore}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="flex h-[90px] items-end gap-1.5 rounded-2xl bg-site-sheet-2 p-3"
      >
        {leoBars(planned).map((bar, week) => (
          <span
            // Eight fixed weeks: the index is the week.
            key={week}
            className={cn(
              'h-(--h) flex-1 rounded-md transition-[height,background-color] duration-[800ms] ease-[cubic-bezier(.3,1.4,.5,1)] motion-reduce:transition-none',
              TONE[bar.tone],
            )}
            style={{ '--h': `${isSeen ? bar.height : 6}%` }}
          />
        ))}
      </div>
      <p aria-live="polite" className="m-0 min-h-[3em] text-[17px] leading-[1.45] font-semibold">
        {planned ? text.textAfter : text.textBefore}
      </p>
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-site-sheet-line pt-3.5">
        <div className="size-10 flex-none">{faces.teacher}</div>
        <div className="flex-1 text-sm leading-[1.35]">
          <strong>{text.teacher}</strong>
          <br />
          {text.teacherRole}
        </div>
        <button
          type="button"
          aria-pressed={planned}
          onClick={() => {
            setPlanned((was) => !was);
          }}
          className={cn(
            'cursor-pointer rounded-xl border-0 px-4 py-[11px] text-sm font-bold',
            planned ? 'bg-site-sheet-2 text-site-sheet-ink' : 'bg-site-navy text-site-white',
            focusRing,
          )}
        >
          {planned ? (
            text.replay
          ) : (
            <>
              {text.start} <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
