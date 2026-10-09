import { QuadMark } from '@quad/tokens/logo';
import { cn } from '@quad/ui';
import { cva } from 'class-variance-authority';

import { SectionHeading } from './SectionHeading';
import { SoftBadge } from './SoftBadge';
import { button, card, lift, prose, tintCard } from './styles';

import type { ArticleSection, Tint, TimelineStep } from '../_lib/article';

/** The vivid app cards on "What Quad is". */
const appCard = cva(
  'flex flex-col gap-3 rounded-[30px] px-[22px] pt-6 pb-[26px] text-site-on-vivid transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-1.5 hover:-rotate-1 motion-reduce:transition-none motion-reduce:hover:transform-none',
  {
    variants: {
      tint: {
        sky: 'bg-site-sky',
        pink: 'bg-site-pink',
        lime: 'bg-site-lime',
        orange: 'bg-site-orange',
      } satisfies Record<Tint, string>,
    },
  },
);

/** The dot on each timeline step: filled sky when done, lime ringed in navy now, open next. */
const dot = cva(
  'absolute top-[5px] left-0 size-6 rounded-full border-4 border-solid max-[760px]:top-0',
  {
    variants: {
      state: {
        done: 'border-site-sky bg-site-sky',
        now: 'border-site-navy bg-site-lime shadow-[0_0_0_6px_var(--quad-site-tag-good-bg)]',
        next: 'border-site-card-line bg-site-card-bg',
      } satisfies Record<TimelineStep['state'], string>,
    },
  },
);

/** A name's initials: "Ada Lovelace" → "AL". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('');

function Timeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <ol className="m-0 grid list-none grid-cols-3 p-0 max-[760px]:grid-cols-1">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="relative pt-11 pr-[18px] max-[760px]:pt-0 max-[760px]:pr-0 max-[760px]:pb-[22px] max-[760px]:pl-11"
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-[15px] right-0 left-0 h-1 rounded-sm',
              'max-[760px]:top-1.5 max-[760px]:-bottom-1.5 max-[760px]:left-2.5 max-[760px]:h-auto max-[760px]:w-1',
              step.state === 'done' ? 'bg-site-sky' : 'bg-site-card-line',
              index === steps.length - 1 && 'max-[760px]:hidden',
            )}
          />
          <span aria-hidden="true" className={dot({ state: step.state })} />
          <small className="mb-1 block text-xs font-bold tracking-[.08em] text-site-page-ink-3 uppercase">
            {step.when}
          </small>
          <b className="block text-xl tracking-[-.02em] text-site-page-ink">{step.title}</b>
          <p className="m-0 mt-1 text-[15.5px] text-site-page-ink-2">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

function StoryCard({ section, isFirst }: { section: ArticleSection; isFirst: boolean }) {
  const { tint } = section;
  const isBig = !section.isHalf;
  const tone = tint ? 'tint' : 'page';
  return (
    <section
      aria-labelledby={section.id}
      className={cn(tint ? tintCard({ tint }) : card, isFirst && lift)}
    >
      <div className={cn('flex items-center gap-3.5', isBig ? 'mb-[18px]' : 'mb-3')}>
        {section.icon && (
          <SoftBadge
            icon={section.icon}
            tone={tint ? 'plain' : (section.tone ?? 'sky')}
            size={isBig ? 'lg' : 'md'}
          />
        )}
        <SectionHeading
          id={section.id}
          title={section.title}
          className={
            isBig
              ? 'text-[clamp(28px,3.2vw,44px)] leading-none'
              : 'text-[clamp(24px,2.4vw,32px)] leading-[1.05]'
          }
        />
      </div>
      {section.cta ? (
        <div className="flex flex-wrap items-end justify-between gap-[18px]">
          <div className={prose({ tone })}>{section.body}</div>
          <a href={section.cta.href} className={button({ variant: 'navy' })}>
            {section.cta.label} <span aria-hidden="true">→</span>
          </a>
        </div>
      ) : (
        <StoryBody section={section} tone={tone} />
      )}
    </section>
  );
}

function StoryBody({ section, tone }: { section: ArticleSection; tone: 'tint' | 'page' }) {
  if (section.person) {
    const { person } = section;
    return (
      <div className="flex flex-wrap items-center gap-[22px]">
        <div
          aria-hidden="true"
          className="relative grid size-24 flex-none place-items-center rounded-full bg-site-navy text-[34px] font-extrabold tracking-[-.04em] text-site-lime"
        >
          {initials(person.name)}
          <QuadMark size={36} title="" className="absolute -right-1.5 -bottom-1.5" />
        </div>
        <div className="min-w-0 flex-[1_1_240px]">
          <h3 className="m-0 text-[26px] font-extrabold tracking-[-.04em] text-site-page-ink">
            {person.name}
          </h3>
          <p className="m-0 font-bold text-site-page-ink-3">{person.role}</p>
          <div className={cn(prose({ tone }), 'mt-1.5')}>{section.body}</div>
        </div>
      </div>
    );
  }
  return (
    <>
      {section.timeline && <Timeline steps={section.timeline} />}
      <div
        className={cn(
          prose({ tone }),
          section.timeline && 'mt-[22px] border-t border-solid border-site-card-line pt-[18px]',
        )}
      >
        {section.body}
      </div>
      {section.apps && (
        <ul className="m-0 mt-[18px] grid list-none grid-cols-3 gap-3.5 p-0 max-[900px]:grid-cols-1">
          {section.apps.map((app) => (
            <li key={app.name} className={appCard({ tint: app.tint })}>
              <SoftBadge icon={app.icon} tone="plain" size="xl" />
              <h3 className="m-0 text-2xl leading-[1.05] font-extrabold tracking-[-.04em]">
                {app.name}
              </h3>
              <p className="m-0 text-base leading-normal">{app.text}</p>
            </li>
          ))}
        </ul>
      )}
      {section.aside && (
        <div className="mt-3.5 flex items-center gap-4">
          <SoftBadge icon={section.aside.icon} tone={section.aside.tone} size="lg" />
          <p className={cn(prose({ tone }), 'm-0')}>{section.aside.text}</p>
        </div>
      )}
      {section.facts && (
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {section.facts.map((fact) => (
            <li
              key={fact}
              className="rounded-full bg-site-sheet-2 px-3.5 py-[7px] text-[14.5px] font-semibold text-site-page-ink"
            >
              {fact}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The About page (D45): one card per section, the first rising into the header. Sections marked
 * `isHalf` pair up two to a row from 900 px; tinted sections sit on pale cards with white badges.
 */
export function StorySections({ sections }: { sections: readonly ArticleSection[] }) {
  const rows: ArticleSection[][] = [];
  for (const section of sections) {
    const last = rows.at(-1);
    if (section.isHalf && last?.length === 1 && last[0]?.isHalf) last.push(section);
    else rows.push([section]);
  }
  return (
    <div className="flex flex-col gap-[clamp(40px,5vw,64px)]">
      {rows.map((row, index) =>
        row.length === 1 && row[0] && !row[0].isHalf ? (
          <StoryCard key={row[0].id} section={row[0]} isFirst={index === 0} />
        ) : (
          <div
            key={row.map((section) => section.id).join()}
            className="grid gap-3.5 min-[901px]:grid-cols-2"
          >
            {row.map((section) => (
              <StoryCard key={section.id} section={section} isFirst={false} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}
