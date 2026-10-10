import type { PlatformTenant } from '@quad/contracts';

/**
 * A school's short name on a neutral tile with its colour as a stripe (a CSS variable, never a
 * class), then its name. The AA brand-fill tile of spec 07 needs the API's palette (M2).
 */
export function SchoolName({ school }: { school: PlatformTenant }) {
  const swatch = school.brandColor === null ? undefined : { '--swatch': school.brandColor };
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        style={swatch}
        className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line bg-surface-2 text-[11.5px] font-extrabold text-ink"
      >
        {school.shortName}
        {swatch ? <span className="absolute inset-x-0 bottom-0 h-1 bg-(--swatch)" /> : null}
      </span>
      <span className="min-w-0 truncate font-semibold text-ink">{school.name}</span>
    </span>
  );
}
