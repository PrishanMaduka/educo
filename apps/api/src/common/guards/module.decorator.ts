import { Reflector } from '@nestjs/core';

import type { PlanModule } from '@quad/contracts';

/** Read by `ModuleGuard` (and the route walk). */
export const PlanModuleMarker = Reflector.createDecorator<PlanModule>();

/**
 * The route belongs to a plan module (spec 05, Plan and module guard): when the school's plan
 * lacks it, 403 `module_not_in_plan`, before the permission check. Only beside `@Can`.
 *
 * Lint note: this keeps the spec's name, so it clashes with Nest's `@Module`. Never import both
 * into one file; keep a module's controller apart from its `*.module.ts`.
 */
export const Module = (module: PlanModule): MethodDecorator & ClassDecorator =>
  PlanModuleMarker(module);
