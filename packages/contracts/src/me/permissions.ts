import { z } from 'zod';

import { StaffPageAccess, StaffPageId } from '../access/staff-pages';
import { IdSchema } from '../common/ids';
import { PermissionKey } from '../permissions';

import { MePreview } from './me';

/**
 * `GET /me/permissions` (spec 05, spec 06): what the person can do in this school, so the staff
 * apps hide the rest. `keys` are the effective permission keys (a preview's, while one is on),
 * `pages` every staff page in side bar order with how much of it opens (`pageAccess`), `home` the
 * page they start on (`roleHome`) and `preview` the role being previewed, if any.
 */
export const MePermissions = z.object({
  keys: z.array(PermissionKey),
  pages: z.array(StaffPageAccess),
  home: StaffPageId,
  preview: MePreview.nullable(),
});
export type MePermissions = z.infer<typeof MePermissions>;

/**
 * `POST /me/role-preview` (spec 06; spec 08 Preview a role): the role to preview and, for a role
 * scoped to its own classes (a teacher), the sample person whose classes it shows. Both must be
 * the session's school's; nothing else is accepted.
 */
export const RolePreviewInput = z
  .object({
    roleId: IdSchema,
    sampleUserId: IdSchema.optional(),
  })
  .strict();
export type RolePreviewInput = z.infer<typeof RolePreviewInput>;
