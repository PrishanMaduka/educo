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
import { useSiteView } from '../_lib/site-view';

import { onlyParent } from './styles';

import type { PersonId } from '../_art/people';
import type { SiteView } from '../_lib/view';
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

export interface AppPhone {
  ask: { kicker: string; question: string; answer: string; source: string };
  pay: { kicker: string; title: string; due: string; button: string };
  family: { kicker: string; title: string; body: string };
}

export interface Highlight {
  label: string;
  colour: string;
  /** Where it sits on the stage (position utilities). */
  place: string;
}

/** A phone, centred on its position (prototype `.phone`). */
const phoneFrame =
  'absolute aspect-[9/18.5] -translate-1/2 rounded-[44px] bg-site-phone p-2.5 shadow-[0_40px_80px_var(--quad-site-phone-shadow),0_0_0_2px_var(--quad-site-phone-edge)]';

/** A card on the app's screens (prototype `.app-card`). */
const appCard =
  'relative z-[1] mx-2.5 mb-2 flex flex-col gap-1.5 rounded-2xl bg-site-white px-3 py-2.5 text-[11.5px] leading-[1.35] shadow-[0_2px_8px_var(--quad-site-feed-shadow)]';
const appKicker = 'text-[10px] font-extrabold tracking-[.06em] text-site-screen-ink-3 uppercase';

/** The phone's tab bar, with one tab on (prototype `.tabbar`). */
function TabBar({ tabs, on }: { tabs: readonly string[]; on: number }) {
  return (
    <div className="relative z-[1] mt-auto flex justify-around border-t border-site-sheet-line bg-site-white px-1.5 pt-2 pb-3">
      {tabs.map((tab, i) => (
        <span
          key={tab}
          className={cn(
            'flex flex-col items-center gap-0.5 text-[9.5px] font-bold',
            i === on ? 'text-site-on-vivid' : 'text-site-screen-ink-3',
          )}
        >
          <i
            className={cn(
              'h-1.5 w-[18px] rounded-[3px]',
              i === on ? 'bg-site-accent' : 'bg-site-screen-track',
            )}
          />
          {tab}
        </span>
      ))}
    </div>
  );
}

/**
 * The hero's phone and Maya's circle around it (spec 19 §2). Moments arrive one by one: the sender
 * lights up, a star or heart flies to the phone and the message lands, said politely in the live
 * region. With reduced motion the phone shows its first two messages and nothing moves. In the
 * parent view the circle steps aside for a second phone (Ask, Pay and Family) and four labels;
 * messages still land, but nobody lights up and nothing flies.
 */
export function HeroStage({
  label,
  phone,
  appPhone,
  highlights,
  avatars,
  messages,
  decorations,
}: {
  label: Record<SiteView, string>;
  phone: {
    initial: string;
    school: [string, string];
    title: string;
    detail: string;
    maya: ReactNode;
    tonight: { kicker: string; text: string };
    tabs: readonly string[];
  };
  appPhone: AppPhone;
  highlights: readonly Highlight[];
  avatars: readonly StageAvatar[];
  messages: readonly StageMessage[];
  decorations: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const view = useSiteView();
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
        // Parents see the app without the circle: nobody lights up and nothing flies.
        const withCircle = document.documentElement.dataset.view !== 'parent';
        setLit(withCircle && isSenderLit(phase) ? message.who : null);
        const flight = withCircle
          ? tokenFlight([isPhone.matches ? avatar.xPhone : avatar.x, avatar.y], phase)
          : null;
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

  const phoneTop = (
    <>
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
    </>
  );
  const rows = visibleFeed(messages, shown);
  const arcs = ringArcs(messages.length);
  const latest = messages[shown - 1];
  return (
    <div className="flex min-w-0 flex-[1_1_400px] justify-center">
      <div
        ref={stageRef}
        role="img"
        aria-label={label[view]}
        className="relative aspect-[13/15] w-full max-w-[560px]"
      >
        <div className="absolute top-1/2 left-1/2 aspect-square w-[84%] -translate-1/2 rounded-full border-2 border-dashed border-site-navy-line view-parent:hidden" />
        <div
          className={cn(
            phoneFrame,
            'top-1/2 left-1/2 z-[2] w-[58%]',
            'view-parent:top-[48%] view-parent:left-[31%] view-parent:w-1/2 max-[560px]:view-parent:w-[58%]',
          )}
        >
          <div className="relative flex size-full flex-col overflow-hidden rounded-[35px] bg-site-paper text-site-on-vivid after:pointer-events-none after:absolute after:inset-x-0 after:bottom-[46px] after:h-[16%] after:bg-linear-to-b after:from-transparent after:to-site-paper">
            {phoneTop}
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
            <div className={cn(appCard, 'mt-1.5 bg-site-chip-orange-bg', onlyParent)}>
              <small className={cn(appKicker, 'text-site-chip-orange-ink')}>
                {phone.tonight.kicker}
              </small>
              <span>{phone.tonight.text}</span>
            </div>
            <TabBar tabs={phone.tabs} on={0} />
          </div>
        </div>
        <div
          className={cn(
            phoneFrame,
            'top-[54%] left-[75%] z-[1] w-[42%] rotate-[5deg] max-[560px]:w-[44%]',
            onlyParent,
          )}
        >
          <div className="relative flex size-full flex-col overflow-hidden rounded-[35px] bg-site-paper text-site-on-vivid">
            {phoneTop}
            <div className={appCard}>
              <small className={appKicker}>{appPhone.ask.kicker}</small>
              <span className="self-end rounded-[12px_12px_3px_12px] bg-site-navy px-[9px] py-1.5 text-site-white">
                {appPhone.ask.question}
              </span>
              <span className="self-start rounded-[12px_12px_12px_3px] bg-site-chip-sky-bg px-[9px] py-1.5 text-site-on-vivid">
                {appPhone.ask.answer}
                <em className="mt-0.5 block text-[10px] text-site-screen-ink-3 not-italic">
                  {appPhone.ask.source}
                </em>
              </span>
            </div>
            <div className={appCard}>
              <small className={appKicker}>{appPhone.pay.kicker}</small>
              <b className="text-sm tracking-[-.01em]">{appPhone.pay.title}</b>
              <div className="flex items-center justify-between">
                <span>{appPhone.pay.due}</span>
                <span className="rounded-full bg-site-lime px-2.5 py-1 text-[11px] font-extrabold text-site-on-vivid">
                  {appPhone.pay.button}
                </span>
              </div>
            </div>
            <div className={appCard}>
              <small className={appKicker}>{appPhone.family.kicker}</small>
              <b className="text-sm tracking-[-.01em]">{appPhone.family.title}</b>
              <span>{appPhone.family.body}</span>
            </div>
            <TabBar tabs={phone.tabs} on={2} />
          </div>
        </div>
        {highlights.map((highlight) => (
          <span
            key={highlight.label}
            className={cn(
              'absolute z-[4] flex items-center gap-1.5 rounded-full bg-site-navy-2 py-[5px] pr-[11px] pl-1.5 text-[12.5px] font-bold whitespace-nowrap text-site-on-navy shadow-[0_8px_20px_var(--quad-site-phone-shadow)] max-[560px]:hidden',
              highlight.place,
              onlyParent,
            )}
          >
            <i
              className="size-[18px] flex-none rounded-full bg-(--c)"
              style={{ '--c': highlight.colour }}
            />
            {highlight.label}
          </span>
        ))}
        {decorations}
        {avatars.map((avatar, i) => {
          const isLit = lit === avatar.who;
          return (
            <div
              key={avatar.who}
              className="absolute top-(--y) left-(--x) z-[3] flex -translate-1/2 flex-col items-center gap-1.5 [animation-delay:var(--dl)] [animation-duration:var(--d)] motion-safe:animate-bob max-[560px]:left-(--xm) view-parent:hidden"
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
