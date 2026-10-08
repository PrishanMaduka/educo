'use client';

import { cn } from '@quad/ui';
import { useEffect, useRef, useState } from 'react';

import { usePrefersReducedMotion } from '../_lib/reduced-motion';
import { GLINT_DURATION_MS, glintAt, nextEvent, TICKER_INTERVAL_MS } from '../_lib/ticker';

import type { ReactNode } from 'react';

type Point = readonly [number, number];

export interface HeroEvent {
  from: Point;
  to: Point;
  title: string;
  detail: string;
  /** The sender's kite, rendered on the server. */
  icon: ReactNode;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Sends one glint from a kite, past Amaya, to another kite. Returns a function that stops it. */
function sendGlint(layer: SVGGElement, from: Point, via: Point, to: Point): () => void {
  const glint = document.createElementNS(SVG_NS, 'g');
  for (const [r, fill, opacity] of [
    [14, 'var(--quad-wc-glint)', '.35'],
    [5, 'var(--quad-wc-glint-core)', '1'],
    [2.2, 'var(--quad-wc-light)', '1'],
  ] as const) {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', String(r));
    dot.setAttribute('fill', fill);
    dot.setAttribute('opacity', opacity);
    glint.append(dot);
  }
  layer.append(glint);
  const started = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const progress = (now - started) / GLINT_DURATION_MS;
    const { at, opacity } = glintAt(from, via, to, progress);
    glint.setAttribute('transform', `translate(${at[0]} ${at[1]})`);
    glint.setAttribute('opacity', String(opacity));
    if (progress < 1) frame = requestAnimationFrame(step);
    else glint.remove();
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    glint.remove();
  };
}

/**
 * The hero's moving parts (spec 19 §3): every 3.2 s a glint travels between two kites past Amaya,
 * and the ticker says what just happened. With reduced motion nothing moves and the ticker shows
 * the first event only.
 */
export function HeroLive({
  painting,
  viewBox,
  via,
  events,
}: {
  painting: ReactNode;
  viewBox: string;
  via: Point;
  events: readonly HeroEvent[];
}) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [isFading, setFading] = useState(false);
  const layerRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (reduced || !layer || events.length === 0) return undefined;
    const stops: (() => void)[] = [];
    const timers: number[] = [];
    const glintFor = (i: number) => {
      const event = events[i];
      if (event) stops.push(sendGlint(layer, event.from, via, event.to));
    };
    let current = 0;
    glintFor(current);
    const interval = window.setInterval(() => {
      current = nextEvent(current, events.length);
      const shown = current;
      setFading(true);
      timers.push(
        window.setTimeout(() => {
          setIndex(shown);
          setFading(false);
        }, 300),
      );
      glintFor(shown);
    }, TICKER_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
      stops.forEach((stop) => {
        stop();
      });
      setIndex(0);
      setFading(false);
    };
  }, [reduced, events, via]);

  const event = events[index];
  return (
    <>
      <div className="relative w-full">
        {painting}
        <svg
          viewBox={viewBox}
          aria-hidden="true"
          focusable="false"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <g ref={layerRef} />
        </svg>
      </div>
      <div
        role="status"
        aria-live="polite"
        className="relative mt-1.5 grid min-h-[70px] w-[min(380px,100%)] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-line bg-surface px-3.5 py-3 shadow-lg max-[900px]:w-[calc(100%-32px)] max-[900px]:max-w-[380px]"
      >
        <span aria-hidden="true" className="block size-[42px] flex-none">
          {event?.icon}
        </span>
        <div
          className={cn(
            'transition-opacity duration-300 motion-reduce:transition-none',
            isFading ? 'opacity-0' : 'opacity-100',
          )}
        >
          <b className="block text-sm leading-[1.3]">{event?.title}</b>
          <small className="block text-[12.5px] font-semibold text-ink-2">{event?.detail}</small>
        </div>
      </div>
    </>
  );
}
