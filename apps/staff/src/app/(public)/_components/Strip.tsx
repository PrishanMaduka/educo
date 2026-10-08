import { cn } from '@quad/ui';

import { Painting } from '../_illustrations/Painting';
import { smallIcons } from '../_illustrations/sections';

import { wrap } from './styles';

import { SLOT_MARKER, splitAround, t } from '@/i18n';

const CLAIMS = [
  { key: 'app', icon: smallIcons.family },
  { key: 'brand', icon: smallIcons.crest },
  { key: 'local', icon: smallIcons.lanka },
] as const;

/** Three short claims with painted icons (spec 19 §4); one column at 820 px. */
export function Strip() {
  return (
    <div className="border-y border-line bg-surface">
      <ul
        className={cn(
          wrap,
          'my-0 grid list-none grid-cols-3 items-center gap-x-[30px] gap-y-3 py-[18px] text-[14.5px] font-semibold text-ink-2 max-[820px]:grid-cols-1',
        )}
      >
        {CLAIMS.map(({ key, icon }) => {
          const [before, after] = splitAround(
            t(`public.strip.${key}`, { lead: SLOT_MARKER }),
            SLOT_MARKER,
          );
          return (
            <li key={key} className="flex items-center gap-3">
              <Painting viewBox="0 0 40 40" paint={icon} className="size-9 flex-none" />
              <span>
                {before}
                <b className="font-extrabold text-ink">{t(`public.strip.${key}.lead`)}</b>
                {after}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
