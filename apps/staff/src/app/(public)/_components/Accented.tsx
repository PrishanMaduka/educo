import { accent as accentClass } from './styles';

import { SLOT_MARKER, splitAround } from '@/i18n';

/**
 * A translated heading with one word in the serif accent, for example "Every child has a
 * *circle.*". `template` is the message translated with `{ accent: SLOT_MARKER }`.
 */
export function Accented({
  template,
  accent,
  className,
}: {
  template: string;
  accent: string;
  className?: string;
}) {
  const [before, after] = splitAround(template, SLOT_MARKER);
  return (
    <>
      {before}
      <span className={className ?? accentClass}>{accent}</span>
      {after}
    </>
  );
}
