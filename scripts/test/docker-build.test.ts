import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { dockerBuildCommand, IMAGES, parseBuildArgs, runBuilds } from '../docker-build.mjs';

const dir = mkdtempSync(join(tmpdir(), 'docker-build-'));
const caFile = join(dir, 'ca.crt');
writeFileSync(caFile, 'not a real certificate');
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const local = { tag: 'quad/api:local' };
const joined = (args: string[]) => args.join(' ');

describe('dockerBuildCommand', () => {
  it('builds the api image through the mirror without host networking when there is no proxy', () => {
    const command = joined(
      dockerBuildCommand('api', { QUAD_IMAGE_REGISTRY: 'mirror.gcr.io/' }, local),
    );
    expect(command).toContain('--build-arg QUAD_IMAGE_REGISTRY=mirror.gcr.io/');
    expect(command).toContain('-f docker/api.Dockerfile');
    expect(command).not.toContain('--network');
    expect(command).not.toContain('--secret');
    expect(command).not.toContain('--push');
  });

  it('starts with docker build, tags the image and ends with the repository root as context', () => {
    const command = dockerBuildCommand('api', {}, local);
    expect(command.slice(0, 2)).toEqual(['docker', 'build']);
    expect(joined(command)).toContain('-t quad/api:local');
    expect(command.at(-1)).toBe('.');
  });

  it('passes an empty registry (Docker Hub) and an empty GIT_SHA when neither is set', () => {
    const command = dockerBuildCommand('api', {}, local);
    expect(command).toContain('QUAD_IMAGE_REGISTRY=');
    expect(command).toContain('GIT_SHA=');
  });

  it('passes GIT_SHA from the environment', () => {
    expect(dockerBuildCommand('api', { GIT_SHA: 'abc123' }, local)).toContain('GIT_SHA=abc123');
  });

  it('uses host networking, the proxy and the CA secret behind a proxy', () => {
    const command = joined(
      dockerBuildCommand(
        'api',
        { HTTPS_PROXY: 'http://127.0.0.1:9', NODE_EXTRA_CA_CERTS: caFile },
        local,
      ),
    );
    expect(command).toContain('--network host');
    expect(command).toContain('--build-arg HTTPS_PROXY=http://127.0.0.1:9');
    expect(command).toContain('--build-arg https_proxy=http://127.0.0.1:9');
    expect(command).toContain(`--secret id=proxy_ca,src=${caFile}`);
  });

  it('passes NO_PROXY through with the proxy so direct hosts stay direct', () => {
    const command = joined(
      dockerBuildCommand(
        'api',
        { https_proxy: 'http://127.0.0.1:9', NO_PROXY: 'localhost,registry.npmjs.org' },
        local,
      ),
    );
    expect(command).toContain('--build-arg HTTPS_PROXY=http://127.0.0.1:9');
    expect(command).toContain('--build-arg NO_PROXY=localhost,registry.npmjs.org');
    expect(command).toContain('--build-arg no_proxy=localhost,registry.npmjs.org');
  });

  it('skips the CA secret when NODE_EXTRA_CA_CERTS does not point at a file', () => {
    const command = joined(
      dockerBuildCommand('api', { NODE_EXTRA_CA_CERTS: join(dir, 'missing.crt') }, local),
    );
    expect(command).not.toContain('--secret');
  });

  it('builds staff on port 3000 and console on port 3001 from the web Dockerfile', () => {
    const staff = joined(dockerBuildCommand('staff', {}, { tag: 'quad/staff:local' }));
    expect(staff).toContain('--build-arg APP=staff --build-arg PORT=3000');
    expect(staff).toContain('-f docker/web.Dockerfile');
    const console = joined(dockerBuildCommand('console', {}, { tag: 'quad/console:local' }));
    expect(console).toContain('--build-arg APP=console --build-arg PORT=3001');
    expect(console).toContain('-f docker/web.Dockerfile');
  });

  it('builds clamav from its own folder', () => {
    expect(joined(dockerBuildCommand('clamav', {}, { tag: 'quad/clamav:local' }))).toContain(
      '-f docker/clamav/Dockerfile',
    );
  });

  it('adds extra build args and --push when asked', () => {
    const command = joined(
      dockerBuildCommand(
        'staff',
        {},
        { tag: 'x', push: true, buildArgs: { NEXT_PUBLIC_APP_ENV: 'staging' } },
      ),
    );
    expect(command).toContain('--build-arg NEXT_PUBLIC_APP_ENV=staging');
    expect(command).toContain('--push');
  });

  it.each(['APP', 'PORT'])('refuses a %s build arg, which would override the recipe', (name) => {
    expect(() =>
      dockerBuildCommand('staff', {}, { tag: 'x', buildArgs: { [name]: 'console' } }),
    ).toThrow(name);
  });

  it('knows the four images', () => {
    expect(IMAGES).toEqual(['api', 'staff', 'console', 'clamav']);
  });
});

describe('parseBuildArgs', () => {
  it('reads the image, tag, push flag and repeated build args', () => {
    expect(
      parseBuildArgs([
        'staff',
        '--tag',
        'r/s:1',
        '--push',
        '--build-arg',
        'A=1',
        '--build-arg',
        'B=x=y',
      ]),
    ).toEqual({ images: ['staff'], tag: 'r/s:1', push: true, buildArgs: { A: '1', B: 'x=y' } });
  });

  it('expands all to the four images in order', () => {
    expect(parseBuildArgs(['all']).images).toEqual(['api', 'staff', 'console', 'clamav']);
  });

  it('refuses an unknown image, a missing image and a malformed build arg', () => {
    expect(() => parseBuildArgs(['web'])).toThrow(/web/);
    expect(() => parseBuildArgs([])).toThrow(/image/);
    expect(() => parseBuildArgs(['api', '--build-arg', 'NOVALUE'])).toThrow(/NOVALUE/);
  });

  it('refuses --tag or --build-arg without a value, or with another flag as the value', () => {
    expect(() => parseBuildArgs(['api', '--tag'])).toThrow(/--tag needs a value/);
    expect(() => parseBuildArgs(['api', '--tag', '--push'])).toThrow(/--tag needs a value/);
    expect(() => parseBuildArgs(['api', '--build-arg'])).toThrow(/--build-arg needs a value/);
    expect(() => parseBuildArgs(['api', '--build-arg', '--push'])).toThrow(
      /--build-arg needs a value/,
    );
  });

  it('refuses unknown flags and a second image', () => {
    expect(() => parseBuildArgs(['api', '--no-cache'])).toThrow(/--no-cache/);
    expect(() => parseBuildArgs(['api', 'staff'])).toThrow(/staff/);
  });

  it('refuses --push without --tag, so a local tag is never pushed', () => {
    expect(() => parseBuildArgs(['api', '--push'])).toThrow(/--push needs --tag/);
    expect(parseBuildArgs(['api', '--push', '--tag', 'r/api:1']).push).toBe(true);
  });

  it.each(['APP', 'PORT'])('refuses --build-arg %s, which the image recipe sets', (name) => {
    expect(() => parseBuildArgs(['staff', '--build-arg', `${name}=x`])).toThrow(name);
  });

  it('refuses --tag with all, since each image needs its own tag', () => {
    expect(() => parseBuildArgs(['all', '--tag', 'x'])).toThrow(/--tag/);
  });
});

describe('runBuilds', () => {
  const parsed = { images: ['api', 'staff'] as const, tag: undefined, push: false, buildArgs: {} };

  it('builds each image with its default tag and stops at the first failure', () => {
    const calls: string[][] = [];
    const lines: string[] = [];
    const code = runBuilds(
      { ...parsed, images: [...parsed.images] },
      {},
      (cmd, args) => {
        calls.push([cmd, ...args]);
        return { status: 3 };
      },
      (line) => lines.push(line),
    );
    expect(code).toBe(3);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.join(' ')).toContain('-t quad/api:local');
  });

  it('prints why docker could not be started and exits 1', () => {
    const lines: string[] = [];
    const code = runBuilds(
      { ...parsed, images: ['api'] },
      {},
      () => ({ status: null, error: new Error('spawnSync docker ENOENT') }),
      (line) => lines.push(line),
    );
    expect(code).toBe(1);
    expect(lines.join('')).toContain('spawnSync docker ENOENT');
  });

  it('returns 0 when every build succeeds', () => {
    expect(
      runBuilds(
        { ...parsed, images: [...parsed.images] },
        {},
        () => ({ status: 0 }),
        () => undefined,
      ),
    ).toBe(0);
  });
});
