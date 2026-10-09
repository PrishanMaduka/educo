import { QuadLogo } from '@quad/tokens/logo';

import { t } from '@/i18n';

const STATS = [
  { value: 'signIn.art.statOneValue', label: 'signIn.art.statOne' },
  { value: 'signIn.art.statTwoValue', label: 'signIn.art.statTwo' },
  { value: 'signIn.art.statThreeValue', label: 'signIn.art.statThree' },
] as const;

/**
 * The Quad-branded panel beside the sign-in card (`design/admin.html` `.auth-art`): before
 * sign-in nobody knows the school yet, so it wears Quad's own navy and lime. Decorative copy, so
 * its big line is a paragraph, not a heading: the card's title is the page's `h1`.
 */
export function AuthArt() {
  return (
    <div className="relative isolate flex flex-col justify-between gap-6 overflow-hidden bg-site-navy p-11 text-site-on-navy max-[860px]:p-6">
      <div
        aria-hidden="true"
        className="absolute -right-[180px] -bottom-[200px] -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-site-lime)_30%,transparent),transparent)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--color-site-on-navy)_1px,transparent_1px)] bg-size-[22px_22px] opacity-10 [mask-image:linear-gradient(180deg,transparent,var(--color-ink)_45%,transparent)]"
      />
      <QuadLogo variant="white" size={34} />
      <div className="max-w-[560px]">
        <p className="m-0 mb-3.5 text-[clamp(34px,4vw,52px)] leading-[1.02] font-extrabold tracking-[-0.04em] max-[860px]:text-[32px]">
          {t('signIn.art.titleStart')}{' '}
          <span className="inline-block -rotate-2 rounded-pill bg-site-lime px-[0.24em] text-site-navy">
            {t('signIn.art.titleHighlight')}
          </span>
        </p>
        <p className="m-0 text-base text-site-on-navy-2">{t('signIn.art.body')}</p>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0 max-[860px]:hidden">
        {STATS.map((stat) => (
          <li
            key={stat.label}
            className="min-w-28 rounded-[18px] border border-site-navy-line bg-site-navy-2 px-4 py-3"
          >
            <b className="block text-[22px] font-extrabold text-site-lime">{t(stat.value)}</b>
            <span className="text-xs text-site-on-navy-2">{t(stat.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
