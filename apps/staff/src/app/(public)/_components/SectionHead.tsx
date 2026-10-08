import { cn } from '@quad/ui';

import { Accented } from './Accented';
import { eyebrow as eyebrowClass, h2 } from './styles';

/** Eyebrow, heading and one sentence, side by side above 820 px (prototype `.sec-h`). */
export function SectionHead({
  id,
  eyebrow,
  title,
  accent,
  lede,
  tone = 'page',
}: {
  id: string;
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  tone?: 'page' | 'band';
}) {
  const onBand = tone === 'band';
  return (
    <div className="mb-10 grid grid-cols-2 items-end gap-x-12 gap-y-5 max-[820px]:grid-cols-1">
      <div>
        <p className={cn('m-0', eyebrowClass, onBand && 'text-band-eyebrow')}>{eyebrow}</p>
        <h2 id={id} className={cn(h2, 'mt-3')}>
          <Accented
            template={title}
            accent={accent}
            className={cn(
              'font-accent font-medium tracking-[-.01em] italic',
              onBand && 'text-band-accent',
            )}
          />
        </h2>
      </div>
      <p className={cn('m-0 max-w-[52ch] text-[17px]', onBand ? 'text-band-ink-2' : 'text-ink-2')}>
        {lede}
      </p>
    </div>
  );
}
