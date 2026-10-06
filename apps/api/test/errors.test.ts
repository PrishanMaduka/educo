import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ErrorBodySchema } from '@quad/contracts';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { sendError, toErrorResponse } from '../src/common/error.filter';
import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../src/common/errors';

import { captureLogs } from './app';

import type { FastifyReply } from 'fastify';

describe('AppError hierarchy', () => {
  it('carries code, message, status and fields', () => {
    const error = new AppError('validation', 'Check the form.', 400, { name: 'Required' });
    expect(error).toBeInstanceOf(Error);
    expect([error.code, error.message, error.status, error.fields]).toEqual([
      'validation',
      'Check the form.',
      400,
      { name: 'Required' },
    ]);
  });

  it.each([
    [new NotFoundError(), 404, 'not_found'],
    [new ForbiddenError(), 403, 'forbidden'],
    [
      new ForbiddenError('module_not_in_plan', 'Fees is not in your plan.'),
      403,
      'module_not_in_plan',
    ],
    [new ConflictError(), 409, 'conflict'],
    [new ConflictError('slot_taken', 'That slot is taken.'), 409, 'slot_taken'],
    [new BusinessRuleError('business_rule', 'Close the term first.'), 422, 'business_rule'],
    [new ValidationError({ email: 'Enter an email address' }), 400, 'validation'],
  ])('%s maps to %i %s', (error, status, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });
});

describe('toErrorResponse', () => {
  it('maps an AppError to its status and body', () => {
    const response = toErrorResponse(new ConflictError('slot_taken', 'That slot is taken.'));
    expect(response).toEqual({
      status: 409,
      body: { code: 'slot_taken', message: 'That slot is taken.' },
    });
    expect(ErrorBodySchema.safeParse(response.body).success).toBe(true);
  });

  it('includes fields only when present', () => {
    const response = toErrorResponse(new ValidationError({ 'guardian.phone': 'Too short' }));
    expect(response.body.fields).toEqual({ 'guardian.phone': 'Too short' });
  });

  it('maps a ZodError to 400 validation keyed by dotted path', () => {
    const schema = z.object({
      name: z.string(),
      guardians: z.array(z.object({ phone: z.string().min(8) })),
    });
    const parsed = schema.safeParse({ guardians: [{ phone: '123' }] });
    if (parsed.success) throw new Error('expected failure');
    const response = toErrorResponse(parsed.error);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation');
    expect(Object.keys(response.body.fields ?? {}).sort()).toEqual(['guardians.0.phone', 'name']);
  });

  it.each([
    [new NotFoundException('Cannot GET /secret/path'), 404, 'not_found'],
    [new BadRequestException(), 400, 'validation'],
  ])('maps a Nest HttpException (%s) by status', (error, status, code) => {
    const response = toErrorResponse(error);
    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
    expect(response.body.message).not.toContain('/secret/path');
  });

  it('maps Fastify errors (FST_ codes) by their statusCode', () => {
    const error = Object.assign(new Error('Unexpected token } in JSON at position 7'), {
      code: 'FST_ERR_CTP_INVALID_JSON_BODY',
      statusCode: 400,
    });
    const response = toErrorResponse(error);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation');
    expect(response.body.message).not.toContain('Unexpected token');
  });

  it('does not trust a statusCode on other errors (for example an HTTP client error)', () => {
    const { lines, logger } = captureLogs();
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    const error = Object.assign(new Error('x'), { statusCode: 401 });
    expect(toErrorResponse(error).status).toBe(500);
    sendError(error, reply as unknown as FastifyReply, logger);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'error', error: { type: 'Error', message: 'x' } });
  });

  it('hides unknown errors behind a 500 internal', () => {
    const response = toErrorResponse(new Error('connection to db-prod-1 failed: password=hunter2'));
    expect(response).toEqual({
      status: 500,
      body: { code: 'internal', message: 'Something went wrong on our side. Please try again.' },
    });
  });

  it('treats a thrown non-error as internal', () => {
    expect(toErrorResponse('boom').status).toBe(500);
  });
});
