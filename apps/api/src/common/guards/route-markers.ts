import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, Reflector } from '@nestjs/core';

import {
  DuringConsoleSignInMarker,
  PlatformRoleMarker,
} from '../../platform/auth/platform-roles.decorator';

import { AuthenticatedMarker } from './authenticated.decorator';
import { CanMarker } from './can.decorator';
import { PlanModuleMarker } from './module.decorator';
import { PlatformControllerMarker } from './platform-controller.decorator';
import { PreAuthMarker } from './pre-auth.decorator';
import { AllowDuringPreviewMarker } from './preview-read-only.guard';
import { PublicMarker } from './public.decorator';
import { RelativeAccessMarker } from './relative-access.decorator';
import { SensitiveMarker } from './sensitive.decorator';
import { AllowWhileSuspendedMarker } from './tenant-status.guard';

import type { Type } from '@nestjs/common';

/**
 * The route walk (Task 12, ruling F02): every route of the app with the markers it carries, read
 * from the controllers' metadata the way the guards read it, and the rules those markers must
 * keep. `AccessModule` refuses to start the API when any route breaks one (fix round 1, M1), and
 * `test/routes-guarded.test.ts` runs it on the real app and on rogue controllers.
 */

/** The five access markers: every route carries exactly one. */
export const ACCESS_MARKERS = [
  'public',
  'preAuth',
  'authenticated',
  'can',
  'platformRole',
] as const;
export type AccessMarker = (typeof ACCESS_MARKERS)[number];

/** Markers that only add to an access marker. */
type ExtraMarker =
  | 'relativeAccess'
  | 'module'
  | 'sensitive'
  | 'allowWhileSuspended'
  | 'allowDuringPreview'
  | 'duringConsoleSignIn';

export interface WalkedRoute {
  /** `GET /me/permissions`, relative to `/api/v1`, with `{id}` parameters as in OpenAPI. */
  readonly route: string;
  readonly handler: string;
  readonly console: boolean;
  readonly access: readonly AccessMarker[];
  readonly extras: readonly ExtraMarker[];
}

const reflector = new Reflector();
const scanner = new MetadataScanner();

const KEYS: Readonly<Record<AccessMarker | ExtraMarker, string>> = {
  public: PublicMarker.KEY,
  preAuth: PreAuthMarker.KEY,
  authenticated: AuthenticatedMarker.KEY,
  can: CanMarker.KEY,
  platformRole: PlatformRoleMarker.KEY,
  relativeAccess: RelativeAccessMarker.KEY,
  module: PlanModuleMarker.KEY,
  sensitive: SensitiveMarker.KEY,
  allowWhileSuspended: AllowWhileSuspendedMarker.KEY,
  allowDuringPreview: AllowDuringPreviewMarker.KEY,
  duringConsoleSignIn: DuringConsoleSignInMarker.KEY,
};

function pathsOf(target: object): string[] {
  const value: unknown = Reflect.getMetadata(PATH_METADATA, target);
  const paths = Array.isArray(value) ? value : [value];
  return paths
    .filter((path): path is string => typeof path === 'string')
    .map((path) => path.replace(/^\/+|\/+$/g, ''));
}

/** Every route of `controllers`, with its markers (as `getAllAndOverride` over handler and class). */
export function walkRoutes(controllers: readonly Type[]): WalkedRoute[] {
  const routes: WalkedRoute[] = [];
  for (const controller of controllers) {
    const prototype: object = controller.prototype as object;
    const console =
      reflector.get<true | undefined>(PlatformControllerMarker.KEY, controller) === true;
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler: unknown = Reflect.get(prototype, name);
      if (typeof handler !== 'function' || !Reflect.hasMetadata(PATH_METADATA, handler)) continue;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      const has = (marker: AccessMarker | ExtraMarker) =>
        reflector.getAllAndOverride<unknown>(KEYS[marker], [handler, controller]) !== undefined;
      const access = ACCESS_MARKERS.filter(has);
      const extras = (Object.keys(KEYS) as (AccessMarker | ExtraMarker)[]).filter(
        (key): key is ExtraMarker => !ACCESS_MARKERS.includes(key as AccessMarker) && has(key),
      );
      for (const prefix of pathsOf(controller).length > 0 ? pathsOf(controller) : ['']) {
        for (const own of pathsOf(handler)) {
          const path = [prefix, own]
            .filter((part) => part !== '')
            .join('/')
            .replace(/:(\w+)/g, '{$1}');
          routes.push({
            route: `${method} /${path}`,
            handler: `${controller.name}.${name}`,
            console,
            access,
            extras,
          });
        }
      }
    }
  }
  return routes;
}

/**
 * `@Authenticated` is for self-scoped routes only: in M1 exactly `/me*`, `POST /auth/sign-out`,
 * `POST /auth/select-school` and `GET /school/branding` (Task 6, D32).
 */
export function mayBeAuthenticated(route: string): boolean {
  const [, path = ''] = route.split(' ');
  return (
    path === '/me' ||
    path.startsWith('/me/') ||
    ['POST /auth/sign-out', 'POST /auth/select-school', 'GET /school/branding'].includes(route)
  );
}

/** Where each exemption marker may appear (the guards' only exceptions, spec 05 and 06). */
const ONLY_ON: Partial<Record<ExtraMarker, readonly string[]>> = {
  allowWhileSuspended: ['POST /auth/sign-out'],
  allowDuringPreview: ['POST /auth/sign-out', 'DELETE /me/role-preview'],
};

/** One line per broken rule; empty when every route is guarded as it should be. */
export function routeProblems(routes: readonly WalkedRoute[]): string[] {
  const problems: string[] = [];
  for (const { route, handler, console, access, extras } of routes) {
    const at = `${route} (${handler})`;
    if (access.length !== 1) {
      problems.push(
        `${at} carries ${access.length} access markers: ${access.join(', ') || 'none'}`,
      );
      continue;
    }
    const [marker] = access;
    if (console && (marker === 'authenticated' || marker === 'can')) {
      problems.push(`${at} is a console route with @${marker}`);
    }
    if (!console && marker === 'platformRole') {
      problems.push(`${at} has @PlatformRole outside a console controller`);
    }
    if (marker === 'authenticated' && !mayBeAuthenticated(route)) {
      problems.push(`${at} is @Authenticated but is not a self-scoped route`);
    }
    for (const extra of extras) {
      const allowedOn = ONLY_ON[extra];
      if (allowedOn !== undefined && !allowedOn.includes(route)) {
        problems.push(`${at} carries @${extra}, which only ${allowedOn.join(' and ')} may`);
      }
    }
    if ((extras.includes('module') || extras.includes('sensitive')) && marker !== 'can') {
      problems.push(`${at} has @Module or @Sensitive without @Can`);
    }
    if (
      extras.includes('relativeAccess') &&
      (console || (marker !== 'authenticated' && marker !== 'can'))
    ) {
      // An addition to a marker that reads the token: @Public reads none, @PreAuth only the cookie.
      problems.push(`${at} has @RelativeAccess without @Authenticated or @Can`);
    }
    if (extras.includes('duringConsoleSignIn') && marker !== 'platformRole') {
      problems.push(`${at} has @DuringConsoleSignIn without @PlatformRole`);
    }
  }
  return problems;
}
