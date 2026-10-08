import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../src/openapi/document';

import { CLOSED_PORTS, useTestApp } from './app';

/** Every route Fastify registers, as `get /api/v1/x`, collected by an onRoute hook. */
const served: string[] = [];
const app = useTestApp(CLOSED_PORTS, {
  beforeInit: (fastify) => {
    fastify.addHook('onRoute', (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        // Fastify adds HEAD for every GET by itself.
        if (method !== 'HEAD') served.push(`${method.toLowerCase()} ${route.url}`);
      }
    });
  },
});

describe('OpenAPI document', () => {
  const document = buildOpenApiDocument();
  const paths = document.paths ?? {};

  it('is OpenAPI 3.1 for the Quad API', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBe('Quad API');
    expect(document.info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('documents the health routes with their responses', () => {
    expect(paths['/api/v1/health/live']?.get?.responses).toHaveProperty('200');
    expect(Object.keys(paths['/api/v1/health/ready']?.get?.responses ?? {})).toEqual([
      '200',
      '503',
    ]);
    expect(document.components?.schemas).toHaveProperty('HealthReady');
    expect(document.components?.schemas).toHaveProperty('ErrorBody');
  });

  it('only documents routes the app actually serves', () => {
    const fastify = app().getHttpAdapter().getInstance();
    for (const [path, item] of Object.entries(paths)) {
      for (const method of Object.keys(item)) {
        const url = path.replace(/\{(\w+)\}/g, ':$1');
        expect(fastify.hasRoute({ method: method.toUpperCase(), url }), `${method} ${path}`).toBe(
          true,
        );
      }
    }
  });

  it('documents every route the app serves', () => {
    const documented = Object.entries(paths).flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method} ${path.replace(/\{(\w+)\}/g, ':$1')}`),
    );
    expect(served.length).toBeGreaterThan(0);
    expect(served.filter((route) => !documented.includes(route))).toEqual([]);
  });

  it('is served at /api/v1/openapi.json', async () => {
    const response = await app()
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(JSON.parse(JSON.stringify(document)));
  });
});
