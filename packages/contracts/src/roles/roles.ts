import { z } from 'zod';

import { StaffPageId } from '../access/staff-pages';
import { HexColor } from '../common/color';
import { IdSchema } from '../common/ids';
import { paginated } from '../common/pagination';
import { PermissionModule, RoleScope, SensitiveKey } from '../enums';

/**
 * Users & roles → Roles & permissions (spec 05 Roles; spec 08): the school's system and custom
 * roles, the role builder and the matrix editor.
 */

/** `:id` of a role. */
export const RoleIdParams = z.object({ id: IdSchema });
export type RoleIdParams = z.infer<typeof RoleIdParams>;

/** One matrix row: the five actions on a module (spec 05, Permission matrix). */
export const MatrixRow = z
  .object({
    view: z.boolean(),
    create: z.boolean(),
    edit: z.boolean(),
    delete: z.boolean(),
    approve: z.boolean(),
  })
  .strict();
export type MatrixRow = z.infer<typeof MatrixRow>;

const matrixShape = {
  admissions: MatrixRow,
  crm: MatrixRow,
  sis: MatrixRow,
  attendance: MatrixRow,
  lms: MatrixRow,
  fees: MatrixRow,
  finance: MatrixRow,
  transport: MatrixRow,
  settings: MatrixRow,
};

/** A role's whole matrix, a row for every module (a module with no access is all false). */
export const RoleMatrix = z.object(matrixShape);
export type RoleMatrix = z.infer<typeof RoleMatrix>;

/** A role as the Roles & permissions page, the role builder and the Preview card read it. */
export const Role = z.object({
  id: IdSchema,
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: HexColor.nullable(),
  /** A system role comes with every school: it cannot be changed or deleted (spec 05). */
  system: z.boolean(),
  scope: RoleScope,
  baseRoleKey: z.string().nullable(),
  /** Members holding it, any status. */
  memberCount: z.number().int().nonnegative(),
  /** How many staff pages it opens (spec 08 Preview a role: "how many pages it can open"). */
  pageCount: z.number().int().nonnegative(),
  /** Where it starts (`roleHome`). */
  home: StaffPageId,
  matrix: RoleMatrix,
  sensitive: z.array(SensitiveKey),
});
export type Role = z.infer<typeof Role>;

/**
 * `GET /roles`: every role of the school, system roles first, then by name (one page), and the
 * matrix rows whose plan module the school lacks, in matrix order: the editor shows them
 * "Not in plan" and `PUT /roles/:id/permissions` refuses them (spec 05, Plan and module guard).
 */
export const RoleList = paginated(Role).extend({ outsidePlan: z.array(PermissionModule) });
export type RoleList = z.infer<typeof RoleList>;

const RoleName = z
  .string()
  .trim()
  .min(1, { message: 'Give the role a name' })
  .max(60, { message: 'Use at most 60 characters' });
const RoleDescription = z.string().trim().max(300, { message: 'Use at most 300 characters' });

/**
 * `PUT /roles/:id/permissions`: the whole matrix (a module left out is no access) and the
 * sensitive keys, each once. The API normalises every row (`normaliseRow`).
 */
export const RolePermissionsInput = z
  .object({
    matrix: z.object(matrixShape).partial().strict(),
    sensitive: z.array(SensitiveKey).superRefine((keys, ctx) => {
      keys.forEach((key, index) => {
        if (keys.indexOf(key) !== index) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index], message: 'Listed twice' });
        }
      });
    }),
  })
  .strict();
export type RolePermissionsInput = z.infer<typeof RolePermissionsInput>;

/**
 * `POST /roles`: a custom role. It starts from `baseRoleKey` (any role of the school, whose
 * matrix and sensitive keys it copies) or from nothing (`null`, "Blank"). With `permissions`, the
 * role is created with that grant instead, checked as `PUT …/permissions` checks it, in the same
 * transaction, so a refused grant creates no role (D48).
 */
export const RoleCreateInput = z
  .object({
    name: RoleName,
    description: RoleDescription.optional(),
    color: HexColor,
    scope: RoleScope,
    baseRoleKey: z.string().min(1).max(64).nullable(),
    permissions: RolePermissionsInput.optional(),
  })
  .strict();
export type RoleCreateInput = z.infer<typeof RoleCreateInput>;

/** `PATCH /roles/:id`: any of the name, description, colour and scope of a custom role. */
export const RoleUpdateInput = z
  .object({
    name: RoleName.optional(),
    description: RoleDescription.nullable().optional(),
    color: HexColor.optional(),
    scope: RoleScope.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, { message: 'Change at least one thing' });
export type RoleUpdateInput = z.infer<typeof RoleUpdateInput>;
