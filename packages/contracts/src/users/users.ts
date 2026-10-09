import { z } from 'zod';

import { SignInEmail } from '../auth/sign-in';
import { IdSchema } from '../common/ids';
import { PageQuerySchema, paginated } from '../common/pagination';
import { IsoDateTimeSchema } from '../common/time';
import { MembershipStatus } from '../enums';

/**
 * Users & roles → Staff accounts (spec 06 School settings and people; spec 08 Users & roles):
 * the school's staff memberships, their invitations and the admin's row actions.
 */

/** `:id` of a member of staff (`users.id`). */
export const UserIdParams = z.object({ id: IdSchema });
export type UserIdParams = z.infer<typeof UserIdParams>;

/** `GET /users?status=&roleId=&q=&cursor=&limit=`. `q` searches the name and the address. */
export const StaffListQuery = PageQuerySchema.extend({
  status: MembershipStatus.optional(),
  roleId: IdSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export type StaffListQuery = z.infer<typeof StaffListQuery>;

/** One row of the staff list: role, status, two-step status and last sign-in (spec 08). */
export const StaffMember = z.object({
  id: IdSchema,
  name: z.string(),
  /** The address the school invited; null only for a membership made without one. */
  email: z.string().nullable(),
  status: MembershipStatus,
  /** The primary role; null for a member without one. */
  role: z.object({ id: IdSchema, name: z.string() }).nullable(),
  twoStepOn: z.boolean(),
  lastSignInAt: IsoDateTimeSchema.nullable(),
  /** When the latest invitation was sent ("Invite sent 2 days ago"); null once never invited. */
  inviteSentAt: IsoDateTimeSchema.nullable(),
});
export type StaffMember = z.infer<typeof StaffMember>;

/**
 * A page of staff, with the page's story summary over the whole school ("14 staff, 3 without
 * two-step"): active and invited members, and the active ones without two-step sign-in.
 */
export const StaffList = paginated(StaffMember).extend({
  summary: z.object({
    staff: z.number().int().nonnegative(),
    withoutTwoStep: z.number().int().nonnegative(),
  }),
});
export type StaffList = z.infer<typeof StaffList>;

/** `POST /users/invite`: 1 to 50 work addresses, each once, and the role they will hold. */
export const StaffInviteInput = z
  .object({
    emails: z
      .array(SignInEmail)
      .min(1, { message: 'Add at least one email address' })
      .max(50, { message: 'Invite at most 50 people at a time' })
      .superRefine((emails, ctx) => {
        emails.forEach((email, index) => {
          if (emails.indexOf(email) !== index) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: 'This address is in the list twice',
            });
          }
        });
      }),
    roleId: IdSchema,
  })
  .strict();
export type StaffInviteInput = z.infer<typeof StaffInviteInput>;

/** The members just invited, in the order the addresses were given. */
export const StaffInviteResult = z.object({ items: z.array(StaffMember) });
export type StaffInviteResult = z.infer<typeof StaffInviteResult>;

/** `PATCH /users/:id`: change the role, deactivate or reactivate (not both left out). */
export const StaffUpdateInput = z
  .object({
    roleId: IdSchema.optional(),
    status: z.enum(['active', 'deactivated']).optional(),
  })
  .strict()
  .refine((input) => input.roleId !== undefined || input.status !== undefined, {
    message: 'Choose a role or a status',
  });
export type StaffUpdateInput = z.infer<typeof StaffUpdateInput>;
