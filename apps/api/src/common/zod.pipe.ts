import { ValidationError } from './errors';

import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Field messages from a Zod failure, keyed by dotted path (first message per path wins). */
export function fieldsFromZodError(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    fields[key] ??= issue.message;
  }
  return fields;
}

/**
 * Parses a body, query or params with its contract schema:
 * `@Body(new ZodValidationPipe(InvoiceRemindInput)) body: InvoiceRemindInput`.
 * Returns the parsed value (defaults, coercion, unknown keys stripped) or throws a 400.
 */
export class ZodValidationPipe<S extends z.ZodTypeAny> implements PipeTransform<
  unknown,
  z.output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(fieldsFromZodError(result.error));
    }
    return result.data as z.output<S>;
  }
}
