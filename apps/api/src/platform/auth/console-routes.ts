import { PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, Reflector } from '@nestjs/core';

import { PlatformControllerMarker } from '../../common/guards/platform-controller.decorator';

import type { Type } from '@nestjs/common';

const reflector = new Reflector();
const scanner = new MetadataScanner();

/** A controller's or route's `@Controller`/`@Get` paths, without slashes at either end. */
function pathsOf(target: object): string[] {
  const value: unknown = Reflect.getMetadata(PATH_METADATA, target);
  const paths = Array.isArray(value) ? value : [value];
  return paths
    .filter((path): path is string => typeof path === 'string')
    .map((path) => path.replace(/^\/+|\/+$/g, ''));
}

const isPlatformPath = (path: string): boolean =>
  path === 'platform' || path.startsWith('platform/');

/**
 * Every route whose path starts with `platform/` must be in a `@PlatformController()` class, and
 * every route of such a class must be under `platform/`: one problem line per route that breaks
 * this. `PlatformAuthModule` refuses to start with any (the structural half of the cookie
 * isolation; the guards also decide by path).
 */
export function consoleRouteProblems(controllers: readonly Type[]): string[] {
  const problems: string[] = [];
  for (const controller of controllers) {
    const isConsole =
      reflector.get<true | undefined>(PlatformControllerMarker.KEY, controller) === true;
    const prefixes = pathsOf(controller);
    const prototype: object = controller.prototype as object;
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler: unknown = Reflect.get(prototype, name);
      if (typeof handler !== 'function' || !Reflect.hasMetadata(PATH_METADATA, handler)) continue;
      for (const prefix of prefixes.length > 0 ? prefixes : ['']) {
        for (const own of pathsOf(handler)) {
          const path = [prefix, own].filter((part) => part !== '').join('/');
          if (isPlatformPath(path) && !isConsole) {
            problems.push(
              `${controller.name}.${name} serves ${path} without @PlatformController()`,
            );
          } else if (!isPlatformPath(path) && isConsole) {
            problems.push(`${controller.name}.${name} is @PlatformController() but serves ${path}`);
          }
        }
      }
    }
  }
  return problems;
}
