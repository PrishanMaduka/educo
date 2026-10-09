import { assignRole, insertSystemRole, setPlanModules } from './access';
import { Browser } from './browser';
import { insertSchool, sessionHeaders, signedInMember } from './identity';

import type { SchoolSeed, SessionSeed } from './identity';
import type { RecordingDelivery } from '../fakes/delivery';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { PlanModule, SystemRoleKey } from '@quad/contracts';
import type { TestDatabase } from '@quad/db/testing';
import type { LightMyRequestResponse as Response } from 'fastify';

/**
 * Arrangement for the Users & roles tests (Task 13): a school with its seven system roles and
 * members holding them, through `quad_platform` (the arrangement step only). Every name is
 * fictional.
 */

export const EVERY_MODULE: readonly PlanModule[] = [
  'admissions',
  'crm',
  'sis',
  'lms',
  'fees',
  'finance',
  'parent',
  'transport',
];

const SYSTEM_ROLE_NAMES: Readonly<Record<SystemRoleKey, string>> = {
  admin: 'School admin',
  principal: 'Principal',
  finance: 'Finance officer',
  admissions: 'Admissions officer',
  teacher: 'Teacher',
  counsellor: 'Counsellor',
  frontdesk: 'Front desk',
};

export interface RolesSchool extends SchoolSeed {
  /** The id of each system role in this school. */
  readonly roles: Readonly<Record<SystemRoleKey, string>>;
}

/** A school on `modules` (every module by default) with its seven system roles. */
export async function schoolWithRoles(
  db: TestDatabase,
  modules: readonly PlanModule[] = EVERY_MODULE,
): Promise<RolesSchool> {
  const school = await insertSchool(db);
  await setPlanModules(db, school.id, modules);
  const role = (key: SystemRoleKey) =>
    insertSystemRole(db, school.id, key, {
      name: SYSTEM_ROLE_NAMES[key],
      scope: key === 'teacher' ? 'own_classes' : 'school',
    });
  const roles = {
    admin: await role('admin'),
    principal: await role('principal'),
    finance: await role('finance'),
    admissions: await role('admissions'),
    teacher: await role('teacher'),
    counsellor: await role('counsellor'),
    frontdesk: await role('frontdesk'),
  };
  return { ...school, roles };
}

export interface StaffSeed {
  readonly accountId: string;
  readonly userId: string;
  /** The account's address, which the membership also knows (as an invitation leaves it). */
  readonly email: string;
  readonly session: SessionSeed;
}

/** A staff member of `school` holding `roleId`, with an active session there. */
export async function staffHolding(
  db: TestDatabase,
  school: SchoolSeed,
  roleId: string,
  options: { readonly name?: string; readonly accountId?: string } = {},
): Promise<StaffSeed> {
  const member = await signedInMember(db, school, options);
  await assignRole(db, school.id, member.userId, roleId);
  const { rows } = await db.platform.query<{ email: string }>(
    `update users u set email = a.email from accounts a
     where a.id = u.account_id and u.id = $1 returning u.email`,
    [member.userId],
  );
  const email = rows[0]?.email;
  if (email === undefined) throw new Error('The member has no account email.');
  return { ...member, email };
}

/** Turns two-step sign-in on for an account (an enabled authenticator). */
export async function turnOnTwoStep(db: TestDatabase, accountId: string): Promise<void> {
  await db.platform.query(
    `insert into credentials (account_id, totp_enabled) values ($1, true)
     on conflict (account_id) do update set totp_enabled = true`,
    [accountId],
  );
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

/** Requests as a staff session, each from a fresh address (its own per-IP bucket). */
export function asStaff(
  app: () => NestFastifyApplication,
  session: Pick<SessionSeed, 'token' | 'csrf'>,
): (method: Method, url: string, body?: unknown) => Promise<Response> {
  return (method, url, body) =>
    app()
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url: `/api/v1${url}`,
        remoteAddress: new Browser(app).ip,
        headers: {
          ...sessionHeaders(session),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
}

/** The token of the newest `template` email queued to `to` (the last path segment of its link). */
export function linkTokenOf(delivery: RecordingDelivery, to: string, template: string): string {
  const job = delivery.emails
    .filter((email) => email.job.to === to && email.job.template === template)
    .at(-1);
  const link = job?.job.params['link'];
  if (typeof link !== 'string') throw new Error(`No ${template} email to ${to}.`);
  const token = new URL(link).pathname.split('/').at(-1);
  if (token === undefined || token === '') throw new Error('The link has no token.');
  return token;
}
