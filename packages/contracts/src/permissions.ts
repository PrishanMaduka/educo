import { z } from 'zod';

/** Stub: the full permission catalogue arrives with the RBAC milestone. */
export const PermissionKey = z.enum(['settings.edit', 'users.manage']);
export type PermissionKey = z.infer<typeof PermissionKey>;
