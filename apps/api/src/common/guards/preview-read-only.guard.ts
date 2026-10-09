import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { formatMessage } from '../delivery/templates/render';
import { ForbiddenError } from '../errors';
import { needsCsrfToken } from '../session/csrf';
import { requestAuthOf } from '../session/request-auth';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/** Read by `PreviewReadOnlyGuard` (and the route walk). */
export const AllowDuringPreviewMarker = Reflector.createDecorator<true>();

/**
 * The route still takes writes while a role preview is on. Only `DELETE /me/role-preview` (Back
 * to my view) and `POST /auth/sign-out` carry it; the route walk refuses it anywhere else.
 */
export const AllowDuringPreview = (): MethodDecorator => AllowDuringPreviewMarker(true);

/**
 * Preview a role is read-only (spec 05, spec 06, spec 08): while the session has a preview, every
 * request but GET, HEAD and OPTIONS answers 403 `preview_read_only`, except
 * `@AllowDuringPreview()` routes. `AuthGuard` checks the CSRF token first (ruling F42), so a write
 * without `X-CSRF-Token` gets the CSRF 403 and never learns about the preview.
 */
@Injectable()
export class PreviewReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = requestAuthOf(request);
    if (auth?.kind !== 'web' || auth.previewRoleId === null) return true;
    if (!needsCsrfToken(request.method)) return true;
    const allowed = this.reflector.getAllAndOverride<true | undefined>(
      AllowDuringPreviewMarker.KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed === true) return true;
    throw new ForbiddenError('preview_read_only', formatMessage('error.previewReadOnly'));
  }
}
