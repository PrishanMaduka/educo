import pino from 'pino';

import { currentRequestContext } from '../common/request-context';

import type { Config } from '../config';
import type { LoggerService } from '@nestjs/common';
import type { Logger } from 'pino';

/**
 * Paths that may hold credentials or personal data. Code should not log these at all (spec 15:
 * never log personal data); redaction is the safety net.
 */
const REDACT_PATHS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'phone',
  'email',
  'name',
  '*.password',
  '*.token',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.phone',
  '*.email',
  '*.name',
  'headers.authorization',
  'headers.cookie',
  // CloudFront's origin secret (D28). The ALB checks it and forwards it to the task.
  'headers["x-quad-origin-secret"]',
  '*.headers["x-quad-origin-secret"]',
];

/**
 * JSON logs (spec 15 → Observability). Every line made inside a request carries `requestId`,
 * `tenantId` and `userId` from the request context.
 */
export function createLogger(
  config: Pick<Config, 'LOG_LEVEL'>,
  service: string,
  destination?: pino.DestinationStream,
): Logger {
  const options: pino.LoggerOptions = {
    level: config.LOG_LEVEL,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    formatters: { level: (label) => ({ level: label }) },
    mixin() {
      const context = currentRequestContext();
      return context
        ? { requestId: context.requestId, tenantId: context.tenantId, userId: context.userId }
        : {};
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

/**
 * Logs an unexpected error without its enumerable extras: driver errors put row values in
 * fields such as `detail`, which can be personal data.
 */
export function errorForLog(error: unknown): { type: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { type: typeof error, message: 'A non-Error value was thrown.' };
}

/** Routes Nest's own logs (bootstrap, route mapping) through pino. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  /** Nest calls `error(message, stack, context)`, or `error(message, context)` without a stack. */
  error(message: unknown, stackOrContext?: string, context?: string): void {
    if (context === undefined) {
      this.write('error', message, stackOrContext);
    } else {
      this.write('error', message, context, stackOrContext);
    }
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(level: pino.Level, message: unknown, context?: string, stack?: string): void {
    const fields = { ...(context ? { context } : {}), ...(stack ? { stack } : {}) };
    if (message instanceof Error) {
      this.logger[level]({ ...fields, error: errorForLog(message) }, message.message);
    } else {
      this.logger[level](fields, typeof message === 'string' ? message : JSON.stringify(message));
    }
  }
}
