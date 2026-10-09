import { EmbedKeyParams, EnquiryInput } from '@quad/contracts';

import { named } from '../../openapi/registry';

import type { ApiRoute } from '../../openapi/registry';

const Enquiry = named('EnquiryInput', EnquiryInput);

export const enquiryRoutes: readonly ApiRoute[] = [
  {
    method: 'post',
    path: '/public/enquiry/{embedKey}',
    summary:
      'An admissions enquiry from a school’s public form, found by its embed key (20 a minute per address; every key is unknown until M4)',
    // The school websites' form, never the parent app.
    tags: ['public'],
    request: { params: EmbedKeyParams, body: Enquiry },
    responses: { 202: { description: 'The enquiry was received' } },
    errors: [400, 404, 429],
  },
];
