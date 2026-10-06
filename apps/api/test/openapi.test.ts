import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../src/openapi/document';

import { CLOSED_PORTS, captureLogs, useTestApp } from './app';

const logs = captureLogs();
const app = useTestApp(CLOSED_PORTS, logs.logger);

/** Routes Nest mapped at startup, from its `Mapped {/api/v1/x, GET} route` log lines. */
function mappedRoutes(): string[] {
  return logs.lines.flatMap((line) => {
    const match = /^Mapped \{(.+), (\w+)\} route$/.exec(String(line.msg));
    return match ? [`${match[2]?.toLowerCase() ?? ''} ${match[1] ?? ''}`] : [];
  });
}

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
    const mapped = mappedRoutes();
    expect(mapped.length).toBeGreaterThan(0);
    expect(mapped.filter((route) => !documented.includes(route))).toEqual([]);
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
