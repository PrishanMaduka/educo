import { Catch, HttpException } from '@nestjs/common';
import { ZodError } from 'zod';

import { errorForLog } from '../observability/logger';
import { NO_OP_REPORTER } from '../observability/sentry';

import { AppError, DEFAULT_MESSAGES, RateLimitedError } from './errors';
import { fieldsFromZodError } from './zod.pipe';

import type { ErrorReporter } from '../observability/sentry';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ErrorBody } from '@quad/contracts';
import type { FastifyReply } from 'fastify';
import type { Logger } from 'pino';

export interface ErrorResponse {
  readonly status: number;
  readonly body: ErrorBody;
}

/** Codes for errors that are not AppErrors (framework 4xx), by HTTP status (spec 06). */
const CODE_BY_STATUS: Readonly<Partial<Record<number, keyof typeof DEFAULT_MESSAGES>>> = {
  400: 'validation',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'business_rule',
  426: 'app_update_required',
  429: 'rate_limited',
};

const INTERNAL: ErrorResponse = {
  status: 500,
  body: { code: 'internal', message: DEFAULT_MESSAGES.internal },
};

/**
 * The status of a framework error: a Nest HttpException, or a Fastify error (its `code` starts
 * with `FST_`). A `statusCode` on anything else (an HTTP client's error, a driver error) says
 * nothing about this request, so those stay unknown and become a logged 500.
 */
function statusOf(error: unknown): number | undefined {
  if (error instanceof HttpException) return error.getStatus();
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('FST_') &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return undefined;
}

/**
 * Maps anything thrown to `{ code, message, fields? }` and a status (spec 06). AppErrors keep
 * their own code and message. Zod failures become 400 `validation` with `fields`. Framework
 * errors are mapped by status with a fixed message, because their text can echo paths or
 * input. Everything else is a 500 `internal`; its details go to the log, never the client.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    const body: ErrorBody = { code: error.code, message: error.message };
    return {
      status: error.status,
      body: error.fields ? { ...body, fields: { ...error.fields } } : body,
    };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        code: 'validation',
        message: DEFAULT_MESSAGES.validation,
        fields: fieldsFromZodError(error),
      },
    };
  }
  const status = statusOf(error);
  if (status === undefined || status < 400 || status >= 500) {
    return INTERNAL;
  }
  // Other 4xx (413 too large, 415 media type…) keep their status and read as validation.
  const code = CODE_BY_STATUS[status] ?? 'validation';
  return { status, body: { code, message: DEFAULT_MESSAGES[code] } };
}

/**
 * Writes the mapped error. Unexpected (5xx) errors are logged with their cause and sent to the
 * error reporter (Sentry); expected ones (4xx) are neither.
 */
export function sendError(
  error: unknown,
  reply: FastifyReply,
  logger: Logger,
  reporter: ErrorReporter = NO_OP_REPORTER,
): void {
  const response = toErrorResponse(error);
  if (response.status >= 500) {
    logger.error({ error: errorForLog(error) }, 'Request failed with an unexpected error');
    reporter.capture(error);
  }
  if (error instanceof RateLimitedError) {
    void reply.header('retry-after', String(error.retryAfterSeconds));
  }
  void reply.status(response.status).send(response.body);
}

/** Global Nest filter: every error thrown in a controller, guard, pipe or service. */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly reporter: ErrorReporter = NO_OP_REPORTER,
  ) {}

  catch(error: unknown, host: ArgumentsHost): void {
    sendError(error, host.switchToHttp().getResponse<FastifyReply>(), this.logger, this.reporter);
  }
}
