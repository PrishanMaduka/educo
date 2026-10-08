'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { loopPath, type LoopPath, type Point } from '../_lib/loop-path';
import { usePrefersReducedMotion } from '../_lib/reduced-motion';

import type { ReactNode } from 'react';

/** How long the glint takes to go once round the loop. */
const LAP_MS = 9000;

interface Arrow {
  x: number;
  y: number;
  angle: number;
}

/** The centres of the four pictures, relative to the wrapper. */
function measure(wrapper: HTMLElement): Point[] {
  const origin = wrapper.getBoundingClientRect();
  return [...wrapper.querySelectorAll('[data-loop-picture]')].map((picture): Point => {
    const box = picture.getBoundingClientRect();
    return [box.left - origin.left + box.width / 2, box.top - origin.top + box.height / 2];
  });
}

/**
 * The painted brush-stroke loop behind the steps (spec 19 §5), measured from where the pictures
 * landed, so it follows the layout at every width. Decorative (`aria-hidden`); the steps are the
 * `<ol>` it wraps. A glint travels round, except with reduced motion.
 */
export function LoopArt({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const glintRef = useRef<SVGGElement>(null);
  const brushRefs = useRef<(SVGPathElement | null)[]>([]);
  const [path, setPath] = useState<LoopPath | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    const draw = () => {
      setPath(loopPath(measure(wrapper)));
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, []);

  // An arrowhead on each stroke, a little past halfway, pointing along it.
  useLayoutEffect(() => {
    if (!path) return;
    const share = path.closed ? 0.52 : 0.55;
    const next: Arrow[] = [];
    for (const brush of brushRefs.current) {
      if (!brush) continue;
      const at = brush.getTotalLength() * share;
      const a = brush.getPointAtLength(at);
      const b = brush.getPointAtLength(at + 2);
      next.push({ x: a.x, y: a.y, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
    }
    setArrows(next);
  }, [path]);

  useEffect(() => {
    const route = routeRef.current;
    const glint = glintRef.current;
    if (!path || !route || !glint) return undefined;
    const place = (share: number) => {
      const p = route.getPointAtLength(share * route.getTotalLength());
      glint.setAttribute('transform', `translate(${p.x} ${p.y})`);
    };
    place(0);
    if (reduced) return undefined;
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      place(((now - started) / LAP_MS) % 1);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [path, reduced]);

  const last = path ? path.segments.length - 1 : -1;
  return (
    <div ref={wrapperRef} className="relative">
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible"
      >
        {path?.segments.map((d, i) => {
          const isReturn = !path.closed && i === last;
          return (
            <g key={d}>
              <path
                d={d}
                fill="none"
                stroke="var(--quad-wc-roof)"
                strokeOpacity=".22"
                strokeWidth="20"
                strokeLinecap="round"
                filter="url(#wcMid)"
              />
              <path
                ref={(el) => {
                  brushRefs.current[i] = el;
                }}
                d={d}
                fill="none"
                stroke="var(--quad-coral-ink)"
                strokeOpacity=".78"
                strokeWidth={isReturn ? 3 : 4.4}
                strokeLinecap="round"
                strokeDasharray={isReturn ? '2 9' : undefined}
                filter="url(#wcFig)"
              />
            </g>
          );
        })}
        {arrows.map((arrow) => (
          <path
            key={`${arrow.x} ${arrow.y}`}
            d="M-10 -9L8 0L-10 9Q-5 0 -10 -9Z"
            transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
            fill="var(--quad-coral-ink)"
            fillOpacity=".9"
            filter="url(#wcFig)"
          />
        ))}
        {path ? <path ref={routeRef} d={path.route} fill="none" stroke="none" /> : null}
        {path ? (
          <g ref={glintRef}>
            <circle r="11" fill="var(--quad-wc-glint)" opacity=".45" />
            <circle r="4" fill="var(--quad-wc-light)" />
          </g>
        ) : null}
      </svg>
      {children}
    </div>
  );
}
