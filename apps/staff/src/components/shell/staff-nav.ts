import {
  STAFF_PAGES,
  type Me,
  type PageAccess,
  type PageHiddenBy,
  type StaffNavGroup,
  type StaffPage,
  type StaffPageAccess,
  type StaffPageId,
} from '@quad/contracts';

/** A page the person can open, as the side bar lists it. */
export interface NavPage {
  readonly id: StaffPageId;
  readonly href: string;
  readonly access: Exclude<PageAccess, 'hidden'>;
  /** Only the Dashboard (`/app`): it is not "current" on the pages below it. */
  readonly exact: boolean;
}

export interface NavGroup {
  readonly group: StaffNavGroup;
  readonly pages: readonly NavPage[];
}

/** How much of a page the person gets (`GET /me/permissions` `pages`); unlisted means hidden. */
export function accessOf(access: readonly StaffPageAccess[], id: StaffPageId): PageAccess {
  return access.find((entry) => entry.id === id)?.access ?? 'hidden';
}

/** Why a page is hidden (`GET /me/permissions` `pages[].hiddenBy`, D52); `role` when unsaid. */
export function hiddenByOf(access: readonly StaffPageAccess[], id: StaffPageId): PageHiddenBy {
  return access.find((entry) => entry.id === id)?.hiddenBy ?? 'role';
}

/**
 * The side bar (spec 08 Navigation): every page the API says opens, in `STAFF_PAGES` order and
 * groups. `pageAccess` (in `@quad/domain`, run by the API) already hid pages for missing
 * permissions and for modules outside the school's plan; groups with nothing left are dropped.
 */
export function visibleNav(access: readonly StaffPageAccess[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const page of STAFF_PAGES) {
    const level = accessOf(access, page.id);
    if (level === 'hidden') continue;
    const entry: NavPage = {
      id: page.id,
      href: page.href,
      access: level,
      exact: page.href === '/app',
    };
    const last = groups.at(-1);
    if (last?.group === page.group) {
      groups[groups.length - 1] = { group: last.group, pages: [...last.pages, entry] };
    } else {
      groups.push({ group: page.group, pages: [entry] });
    }
  }
  return groups;
}

/** The staff page at exactly this path (a trailing `/` allowed), if any. */
export function pageAtPath(path: string): StaffPage | undefined {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return STAFF_PAGES.find((page) => page.href === normalized);
}

/** The path of a staff page. */
export function hrefOf(id: StaffPageId): string {
  const page = STAFF_PAGES.find((candidate) => candidate.id === id);
  if (page === undefined) throw new Error(`Unknown staff page ${id}`);
  return page.href;
}

/**
 * The role the portal is shown as: the previewed role while a preview is on, else the person's
 * primary role; null in a support visit, which has no membership.
 */
export function roleNameOf(me: Pick<Me, 'person' | 'preview'>): string | null {
  return me.preview?.roleName ?? me.person.roleNames[0] ?? null;
}
