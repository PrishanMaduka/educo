'use client';

import { useEffect, useState } from 'react';

import { usePrefersReducedMotion } from '../_lib/reduced-motion';

/** One letter every 70 ms, then a pause of 30 steps with the whole answer shown, then again. */
const STEP_MS = 70;
const PAUSE_STEPS = 30;

/** How much of the answer shows at a step of the typing loop. */
export function typedAt(answer: string, step: number): string {
  const position = step % (answer.length + PAUSE_STEPS + 1);
  return answer.slice(0, Math.min(position, answer.length));
}

/**
 * Ask Quad's answer, typed out (spec 19 "Ask Quad" card). Screen readers get the whole answer at
 * once; with reduced motion it is simply shown.
 */
export function TypedAnswer({ answer }: { answer: string }) {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(answer.length);

  useEffect(() => {
    if (reduced) return undefined;
    const timer = window.setInterval(() => {
      setStep((was) => was + 1);
    }, STEP_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [reduced]);

  return (
    <>
      <span className="sr-only">{answer}</span>
      <span aria-hidden="true">
        {reduced ? answer : typedAt(answer, step)}
        <span className="motion-safe:animate-caret">▍</span>
      </span>
    </>
  );
}
