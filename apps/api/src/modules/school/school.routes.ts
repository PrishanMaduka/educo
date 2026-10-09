import {
  IfMatchHeaders,
  School,
  SchoolBranding,
  SchoolSettings,
  SchoolUpdateInput,
} from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Profile = named('School', School);
const Update = named('SchoolUpdateInput', SchoolUpdateInput);
const Branding = named('SchoolBranding', SchoolBranding);
const Settings = named('SchoolSettings', SchoolSettings);

/** Staff portal only: the `staff` tag keeps these out of the parent app's client. */
const TAGS = ['school', 'staff'] as const;

export const schoolRoutes: readonly ApiRoute[] = [
  {
    method: 'get',
    path: '/school',
    summary:
      'School settings → General, with the read-only time zone, branding and sign-in rules (managed by Quad), the summary and the etag (settings.view)',
    tags: TAGS,
    responses: { 200: { description: 'The school', schema: Profile } },
    errors: [401, 403],
  },
  {
    method: 'patch',
    path: '/school',
    summary:
      'Change General (name, office email and phone, address, SMS sender ID); Quad’s fields are refused with 400, a stale If-Match with 409 (settings.edit; needs X-CSRF-Token)',
    tags: TAGS,
    request: { headers: IfMatchHeaders, body: Update },
    responses: { 200: { description: 'The school', schema: Profile } },
    errors: [400, 401, 403, 409],
  },
  {
    method: 'get',
    path: '/school/branding',
    summary: 'The school’s colour and logo, set by Quad (any signed-in member)',
    tags: TAGS,
    responses: { 200: { description: 'The branding', schema: Branding } },
    errors: [401, 403],
  },
  {
    method: 'get',
    path: '/settings',
    summary: 'The school’s other settings, read-only for now (settings.view)',
    tags: TAGS,
    responses: { 200: { description: 'The settings', schema: Settings } },
    errors: [401, 403],
  },
];
