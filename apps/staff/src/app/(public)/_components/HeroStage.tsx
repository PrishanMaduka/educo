'use client';

import { cn } from '@quad/ui';
import { useEffect, useRef, useState } from 'react';

import {
  FIRST_SHOWN,
  feedMoment,
  hasLanded,
  isSenderLit,
  ringArcs,
  tokenFlight,
  visibleFeed,
} from '../_lib/hero-feed';
import { usePrefersReducedMotion } from '../_lib/reduced-motion';

import type { PersonId } from '../_art/people';
import type { ReactNode } from 'react';

export interface StageAvatar {
  who: PersonId;
  name: string;
  /** Position in percent of the stage; `xPhone` below 560 px. */
  x: number;
  y: number;
  xPhone: number;
  /** The role colour behind the name when the avatar lights up. */
  colour: string;
  face: ReactNode;
}

export interface StageMessage {
  who: PersonId;
  name: string;
  verb: string;
  text: string;
  time: string;
  action?: string;
  /** What the screen reader hears when it lands. */
  live: string;
  face: ReactNode;
  token: ReactNode;
  /** The ring colour for this message (the sender's role). */
  colour: string;
}

const PHONE_QUERY = '(max-width: 560px)';

/**
 * The hero's phone and Maya's circle around it (spec 19 §2). Moments arrive one by one: the sender
 * lights up, a star or heart flies to the phone and the message lands, said politely in the live
 * region. With reduced motion the phone shows its first two messages and nothing moves.
 */
export function HeroStage({
  label,
  phone,
  avatars,
  messages,
  decorations,
}: {
  label: string;
  phone: {
    initial: string;
    school: [string, string];
    title: string;
    detail: string;
    maya: ReactNode;
  };
  avatars: readonly StageAvatar[];
  messages: readonly StageMessage[];
  decorations: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(FIRST_SHOWN);
  const [isFresh, setFresh] = useState(false);
  const [lit, setLit] = useState<PersonId | null>(null);
  const [token, setToken] = useState<ReactNode>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const flyer = tokenRef.current;
    if (reduced || !stage || !flyer || messages.length === 0) return undefined;
    const isPhone = window.matchMedia(PHONE_QUERY);
    const started = performance.now();
    let cycleSeen = -1;
    let landed = -1;
    let frame = 0;
    const tick = (now: number) => {
      const { cycle, index, phase } = feedMoment(now - started, messages.length);
      const message = messages[index];
      const avatar = avatars.find((a) => a.who === message?.who);
      if (message && avatar) {
        if (cycle !== cycleSeen) {
          cycleSeen = cycle;
          setToken(message.token);
        }
        setLit(isSenderLit(phase) ? message.who : null);
        const flight = tokenFlight([isPhone.matches ? avatar.xPhone : avatar.x, avatar.y], phase);
        flyer.hidden = flight === null;
        if (flight) {
          flyer.style.left = `calc(${flight.x}% - 15px)`;
          flyer.style.top = `calc(${flight.y}% - 15px)`;
          flyer.style.transform = `rotate(${flight.rotate}deg) scale(${flight.scale})`;
        }
        if (hasLanded(phase) && landed !== cycle) {
          landed = cycle;
          setShown(index + 1);
          setFresh(true);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      flyer.hidden = true;
    };
  }, [reduced, messages, avatars]);

  const rows = visibleFeed(messages, shown);
  const arcs = ringArcs(messages.length);
  const latest = messages[shown - 1];
  return (
    <div className="flex min-w-0 flex-[1_1_400px] justify-center">
      <div
        ref={stageRef}
        role="img"
        aria-label={label}
        className="relative aspect-[13/15] w-full max-w-[560px]"
      >
        <div className="absolute top-1/2 left-1/2 aspect-square w-[84%] -translate-1/2 rounded-full border-2 border-dashed border-site-navy-line" />
        <div className="absolute top-1/2 left-1/2 z-[2] aspect-[9/18.5] w-[58%] -translate-1/2 rounded-[44px] bg-site-phone p-2.5 shadow-[0_40px_80px_var(--quad-site-phone-shadow),0_0_0_2px_var(--quad-site-phone-edge)]">
          <div className="relative flex size-full flex-col overflow-hidden rounded-[35px] bg-site-paper text-site-on-vivid after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[22%] after:bg-linear-to-b after:from-transparent after:to-site-paper">
            <div className="flex justify-center pt-2">
              <span className="h-5 w-[34%] rounded-full bg-site-phone" />
            </div>
            <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5">
              <span className="grid size-[26px] place-items-center rounded-lg bg-site-school-green text-[11px] font-extrabold text-site-white">
                {phone.initial}
              </span>
              <span className="text-[11px] leading-[1.2] font-semibold text-site-screen-ink-3">
                {phone.school[0]}
                <br />
                {phone.school[1]}
              </span>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 pt-0.5 pb-2.5">
              <div className="relative size-[62px] flex-none">
                <svg viewBox="0 0 62 62" className="absolute inset-0 size-full" aria-hidden="true">
                  <circle
                    cx="31"
                    cy="31"
                    r="27"
                    fill="none"
                    stroke="var(--quad-site-screen-track)"
                    strokeWidth="6"
                  />
                  {arcs.map((arc, i) => (
                    <circle
                      key={arc.offset}
                      cx="31"
                      cy="31"
                      r="27"
                      fill="none"
                      stroke={messages[i]?.colour}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={arc.dash}
                      strokeDashoffset={arc.offset}
                      transform="rotate(-90 31 31)"
                      className={cn(
                        'transition-opacity duration-[600ms] motion-reduce:transition-none',
                        i < shown ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  ))}
                </svg>
                <div className="absolute inset-3">{phone.maya}</div>
              </div>
              <div>
                <b className="block text-lg leading-none font-extrabold tracking-[-.02em]">
                  {phone.title}
                </b>
                <small className="mt-[3px] block text-[11px] text-site-screen-ink-3">
                  {phone.detail}
                </small>
              </div>
            </div>
            <div className="relative flex flex-1 flex-col gap-2 overflow-hidden px-2.5">
              {rows.map((message, i) => (
                <div
                  key={`${message.who}-${message.time}`}
                  className={cn(
                    'flex gap-2.5 rounded-[18px] bg-site-white px-3 py-2.5 shadow-[0_2px_8px_var(--quad-site-feed-shadow)]',
                    i === 0 && isFresh && 'motion-safe:animate-slide-in',
                  )}
                >
                  <div className="size-[30px] flex-none">{message.face}</div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="text-[11.5px] leading-[1.3]">
                      <strong>{message.name}</strong> {message.verb}
                      <span className="text-site-feed-time"> · {message.time}</span>
                    </div>
                    <div className="text-xs leading-[1.35] text-site-screen-ink-2">
                      {message.text}
                    </div>
                    {message.action ? (
                      <span className="mt-1 self-start rounded-full bg-site-navy px-[9px] py-[3px] text-[10.5px] font-bold text-site-white">
                        {message.action}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {decorations}
        {avatars.map((avatar, i) => {
          const isLit = lit === avatar.who;
          return (
            <div
              key={avatar.who}
              className="absolute top-(--y) left-(--x) z-[3] flex -translate-1/2 flex-col items-center gap-1.5 [animation-delay:var(--dl)] [animation-duration:var(--d)] motion-safe:animate-bob max-[560px]:left-(--xm)"
              style={{
                '--x': `${avatar.x}%`,
                '--y': `${avatar.y}%`,
                '--xm': `${avatar.xPhone}%`,
                '--d': `${4.6 + i * 0.6}s`,
                '--dl': `${i * 0.35}s`,
                '--role': avatar.colour,
              }}
            >
              <div
                className={cn(
                  'size-[clamp(54px,7vw,76px)] rounded-full transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.6,.5,1)] motion-reduce:transition-none',
                  isLit &&
                    'scale-[1.14] shadow-[0_0_0_4px_var(--quad-site-paper)] motion-safe:animate-ping-soft',
                )}
              >
                {avatar.face}
              </div>
              <span
                className={cn(
                  'rounded-full px-[9px] py-[3px] text-xs font-bold whitespace-nowrap transition-colors duration-300 max-[560px]:px-[7px] max-[560px]:py-0.5 max-[560px]:text-[11px]',
                  isLit ? 'bg-(--role) text-site-on-vivid' : 'bg-site-navy-2 text-site-on-navy-2',
                )}
              >
                {avatar.name}
              </span>
            </div>
          );
        })}
        <div
          ref={tokenRef}
          hidden
          aria-hidden="true"
          className="pointer-events-none absolute z-[4] size-[30px] drop-shadow-[0_4px_8px_var(--quad-site-phone-shadow)]"
        >
          {token}
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {latest?.live}
      </p>
    </div>
  );
}
