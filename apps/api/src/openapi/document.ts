import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { version } from '../../package.json';
import { healthRoutes } from '../health/health.routes';
import { meRoutes } from '../modules/me/me.routes';
import { rolesRoutes } from '../modules/roles/roles.routes';
import { schoolRoutes } from '../modules/school/school.routes';
import { usersRoutes } from '../modules/users/users.routes';
import { platformAuthRoutes } from '../platform/auth/platform-auth.routes';
import { authRoutes } from '../public/auth/auth.routes';
import { enquiryRoutes } from '../public/enquiry/enquiry.routes';
import { sesWebhookRoutes } from '../webhooks/ses/ses-webhook.routes';

import { openApiRoutes } from './openapi.routes';
import { createRegistry } from './registry';

import type { ApiRoute } from './registry';

/**
 * Every documented route. Listed explicitly (not collected as modules load) so the document is
 * the same whether or not the server has started. Add each new area's routes here.
 */
export const API_ROUTES: readonly ApiRoute[] = [
  ...healthRoutes,
  ...openApiRoutes,
  ...sesWebhookRoutes,
  // Before the auth routes, so the generated Dart client keeps the name `MeSchoolBrand` for the
  // brand palette both areas share.
  ...meRoutes,
  ...authRoutes,
  ...platformAuthRoutes,
  ...usersRoutes,
  ...rolesRoutes,
  ...schoolRoutes,
  ...enquiryRoutes,
];

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

/** Builds the OpenAPI 3.1 document from the Zod contracts, without starting a server. */
export function buildOpenApiDocument(routes: readonly ApiRoute[] = API_ROUTES): OpenApiDocument {
  const generator = new OpenApiGeneratorV31(createRegistry(routes).definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Quad API',
      version,
      description: 'School, parent and console routes. Errors are `{ code, message, fields? }`.',
    },
  });
}
