import type { ReactNode } from 'react';

/** One card: a heading and its facts as "Label: value" lines. */
export interface FactCard {
  title: string;
  /** The lines under the heading, in order; a line with no value is left out. */
  facts: readonly (readonly [label: string, value: ReactNode | undefined])[];
}

/**
 * Small cards inside a legal page's section (the privacy policy's companies, the cookie notice's
 * cookies), as many to a row as fit the section's card and one on phones (D44).
 */
export function FactCards({ label, cards }: { label: string; cards: readonly FactCard[] }) {
  return (
    <ul
      className="my-4! grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-2.5 p-0!"
      aria-label={label}
    >
      {cards.map((card) => (
        <li
          key={card.title}
          className="m-0! rounded-[18px] border border-solid border-site-card-line bg-site-sheet-2 px-4! py-3.5! text-[14.5px] leading-[1.45]"
        >
          <h3 className="m-0! text-base! break-words text-site-page-ink">{card.title}</h3>
          <dl className="m-0 mt-2 grid gap-y-1.5">
            {card.facts
              .filter(([, value]) => value !== undefined)
              .map(([name, value]) => (
                <div key={name}>
                  <dt className="inline font-bold text-site-page-ink">{name}: </dt>
                  <dd className="m-0 inline">{value}</dd>
                </div>
              ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
