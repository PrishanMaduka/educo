import { cn } from '@quad/ui';

import { focusRing } from './styles';

/**
 * A section's `<h2>`: it carries the section's anchor `id` and links to itself, with a `#` that
 * shows on hover and focus (D41). The ink follows the card it sits on.
 */
export function SectionHeading({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        'm-0 scroll-mt-28 leading-[1.1] font-extrabold tracking-[-.035em] text-balance',
        className,
      )}
    >
      <a
        href={`#${id}`}
        className={cn('group rounded-sm text-current no-underline hover:underline', focusRing)}
      >
        {title}
        <span
          aria-hidden="true"
          className="ml-2 opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
        >
          #
        </span>
      </a>
    </h2>
  );
}
