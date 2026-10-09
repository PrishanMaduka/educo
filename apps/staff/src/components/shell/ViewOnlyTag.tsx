import { ShieldCheck } from 'lucide-react';

import { t } from '@/i18n';

/**
 * The **View only** tag (spec 08, prototype `.rv-ro-pill`): the page opens, but the role cannot
 * change anything on it, so the page shows this in place of its action buttons.
 */
export function ViewOnlyTag() {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-extrabold text-ink-2">
      <ShieldCheck aria-hidden="true" strokeWidth={2} className="size-[13px]" />
      {t('viewOnly.tag')}
    </span>
  );
}
