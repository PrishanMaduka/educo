import { cn } from '@quad/ui';

import { WATERCOLOUR_FILTERS } from './filters';
import { esc } from './paint';

/**
 * Renders one watercolour illustration as static SVG on the server (spec 19 "How the
 * illustrations ship"). `paint` returns the scene's markup, built from the pigment tokens only.
 * Decorative unless `title` is given, in which case the picture is one labelled image.
 */
export function Painting({
  viewBox,
  paint,
  title,
  className,
}: {
  viewBox: string;
  paint: () => string;
  title?: { id: string; text: string };
  className?: string;
}) {
  const markup = title ? `<title id="${title.id}">${esc(title.text)}</title>${paint()}` : paint();
  return (
    <svg
      viewBox={viewBox}
      className={cn('block h-auto w-full overflow-visible', className)}
      {...(title
        ? { role: 'img', 'aria-labelledby': title.id }
        : { 'aria-hidden': true, focusable: false })}
      // The markup is built on the server from constants and en.json strings (escaped), never from input.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/** The shared watercolour filters, once per page (every painting refers to them by id). */
export function WatercolourFilters() {
  return (
    <svg
      width="0"
      height="0"
      className="absolute"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: `<defs>${WATERCOLOUR_FILTERS}</defs>` }}
    />
  );
}
