import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '../src/common/errors';
import { ZodValidationPipe } from '../src/common/zod.pipe';

const Body = z.object({ name: z.string().min(1), limit: z.coerce.number().int().default(50) });

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(Body);

  it('returns the parsed value, with defaults and coercion applied', () => {
    expect(pipe.transform({ name: 'Amaya', limit: '10', extra: true })).toEqual({
      name: 'Amaya',
      limit: 10,
    });
    expect(pipe.transform({ name: 'Amaya' })).toEqual({ name: 'Amaya', limit: 50 });
  });

  it('throws a ValidationError with fields keyed by path', () => {
    let caught: unknown;
    try {
      pipe.transform({ name: '', limit: 'x' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    const error = caught as ValidationError;
    expect(Object.keys(error.fields ?? {}).sort()).toEqual(['limit', 'name']);
  });

  it('keys a top-level failure as _root', () => {
    expect(() => pipe.transform('not an object')).toThrow(ValidationError);
    try {
      pipe.transform(null);
    } catch (error) {
      expect((error as ValidationError).fields).toHaveProperty('_root');
    }
  });
});
