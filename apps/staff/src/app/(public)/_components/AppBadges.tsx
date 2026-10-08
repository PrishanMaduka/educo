import { cn } from '@quad/ui';

import { t } from '@/i18n';

/**
 * "Coming soon" App Store and Google Play badges (spec 19): drawn here, not the stores' artwork,
 * since the parent app is not in the stores yet. Each is one labelled image.
 */
export function AppBadges({ tone = 'hero' }: { tone?: 'hero' | 'demo' }) {
  const badge = cn(
    'inline-flex items-center gap-2.5 rounded-[14px] border-2 border-solid py-2 pr-3.5 pl-2.5 text-base leading-[1.05] font-extrabold tracking-[-.01em] text-site-on-navy',
    tone === 'demo' ? 'border-site-navy bg-site-navy' : 'border-site-navy-border bg-site-navy-2',
  );
  const lead = 'block text-[11px] font-semibold tracking-normal text-site-on-navy-2';
  return (
    <span className="flex flex-wrap gap-2.5">
      <span role="img" aria-label={t('public.badges.appStore.label')} className={badge}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 flex-none">
          <rect
            x="6"
            y="2"
            width="12"
            height="20"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>
          <small className={lead}>{t('public.badges.appStore.lead')}</small>
          {t('public.badges.appStore.name')}
        </span>
      </span>
      <span role="img" aria-label={t('public.badges.googlePlay.label')} className={badge}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 flex-none">
          <path
            d="M6 3.5v17l14-8.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          <small className={lead}>{t('public.badges.googlePlay.lead')}</small>
          {t('public.badges.googlePlay.name')}
        </span>
      </span>
    </span>
  );
}
