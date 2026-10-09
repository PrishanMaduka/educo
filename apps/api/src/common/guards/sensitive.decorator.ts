import { Reflector } from '@nestjs/core';

import type { SensitiveKey } from '@quad/contracts';

/** Read by `CanGuard` (and the route walk). */
export const SensitiveMarker = Reflector.createDecorator<SensitiveKey>();

/**
 * The route shows or changes sensitive data (spec 05: sensitive keys). Beside `@Can`, it also
 * needs `sensitive.<key>`; a Quad support visit is always refused `safeguarding` and `medical`,
 * whatever its permissions; and every request it lets through writes `sensitive.accessed` to the
 * school's audit log (the key, method and route, never the data). 403 `forbidden` otherwise.
 */
export const Sensitive = (key: SensitiveKey): MethodDecorator & ClassDecorator =>
  SensitiveMarker(key);
