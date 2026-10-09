import { t } from '@/i18n';

/** "Skip to main content", shown when focused (spec 19 accessibility). */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute -top-20 left-4 z-[60] rounded-xl bg-site-lime px-4 py-2.5 font-bold text-site-on-vivid no-underline focus:top-3"
    >
      {t('public.skip')}
    </a>
  );
}
