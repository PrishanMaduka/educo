import { describe, expect, it } from 'vitest';

import { PARENT_TAGS, parentSpec, platformLeaks } from '../parent-openapi.mjs';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: string) => ({ content: { 'application/json': { schema: ref(name) } } });

const document = {
  openapi: '3.1.0',
  info: { title: 'Quad API', version: '0.0.0' },
  paths: {
    '/api/v1/me': { get: { tags: ['me'], responses: { 200: json('Me') } } },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['auth'],
        requestBody: json('RefreshInput'),
        responses: { 200: json('TokenPair') },
      },
    },
    '/api/v1/platform/me': { get: { tags: ['platform'], responses: { 200: json('PlatformMe') } } },
    '/api/v1/webhooks/ses': { post: { tags: ['webhooks'], responses: { 200: json('SesResult') } } },
  },
  components: {
    schemas: {
      Me: { type: 'object', properties: { brand: ref('Brand') } },
      Brand: { type: 'string' },
      RefreshInput: { type: 'object' },
      TokenPair: { type: 'object' },
      PlatformMe: { type: 'object', properties: { role: ref('PlatformRole') } },
      PlatformRole: { type: 'string' },
      SesResult: { type: 'object' },
    },
  },
};

describe('parentSpec (the parent app’s client, M9)', () => {
  it('keeps only the parent-facing tags', () => {
    expect(PARENT_TAGS).toEqual(['health', 'auth', 'me']);
    expect(Object.keys(parentSpec(document).paths)).toEqual(['/api/v1/me', '/api/v1/auth/refresh']);
  });

  it('keeps only the schemas those routes reach, through nested references', () => {
    expect(Object.keys(parentSpec(document).components.schemas).sort()).toEqual([
      'Brand',
      'Me',
      'RefreshInput',
      'TokenPair',
    ]);
  });

  it('leaves the input document as it was', () => {
    const before = JSON.stringify(document);
    parentSpec(document);
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe('platformLeaks (codegen check)', () => {
  it('names generated files that serve the console', () => {
    expect(
      platformLeaks([
        'lib/src/api/auth_api.dart',
        'lib/src/api/platform_api.dart',
        'lib/src/model/platform_me.dart',
        'doc/PlatformApi.md',
      ]),
    ).toEqual([
      'lib/src/api/platform_api.dart',
      'lib/src/model/platform_me.dart',
      'doc/PlatformApi.md',
    ]);
  });
});
