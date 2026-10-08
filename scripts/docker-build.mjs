#!/usr/bin/env node
// Builds the container images (`pnpm images:build`, D28):
//   node scripts/docker-build.mjs <api|staff|console|clamav|all> [--tag <ref>] [--push]
//     [--build-arg K=V]...
// The default tag is quad/<image>:local. QUAD_IMAGE_REGISTRY (for example `mirror.gcr.io/`)
// prefixes every base image. Behind a proxy (HTTPS_PROXY), the build uses host networking and the
// proxy build args, and the proxy's CA (NODE_EXTRA_CA_CERTS) is mounted as a BuildKit secret only
// into the RUN steps that download, so neither ends up in an image.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @typedef {'api' | 'staff' | 'console' | 'clamav'} Image */
/** @typedef {{ tag: string, push?: boolean, buildArgs?: Record<string, string> }} BuildOptions */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {readonly Image[]} */
export const IMAGES = ['api', 'staff', 'console', 'clamav'];

/** @type {Record<Image, { file: string, args: Record<string, string> }>} */
const RECIPES = {
  api: { file: 'docker/api.Dockerfile', args: {} },
  // Ports are fixed by spec 02: staff 3000, console 3001.
  staff: { file: 'docker/web.Dockerfile', args: { APP: 'staff', PORT: '3000' } },
  console: { file: 'docker/web.Dockerfile', args: { APP: 'console', PORT: '3001' } },
  clamav: { file: 'docker/clamav/Dockerfile', args: {} },
};

/** Build args the recipe sets per image; overriding them would build the wrong app or port. */
const RECIPE_ARGS = ['APP', 'PORT'];

/** @param {Record<string, string>} buildArgs */
function refuseRecipeArgs(buildArgs) {
  const clash = RECIPE_ARGS.filter((name) => Object.hasOwn(buildArgs, name));
  if (clash.length > 0) {
    throw new Error(
      `--build-arg ${clash.join(', ')} is set by the image recipe and cannot be passed.`,
    );
  }
}

/** @param {Record<string, string>} args */
const buildArgFlags = (args) =>
  Object.entries(args).flatMap(([key, value]) => ['--build-arg', `${key}=${value}`]);

/** @param {string | undefined} path */
const isFile = (path) =>
  path !== undefined && path !== '' && existsSync(path) && statSync(path).isFile();

/**
 * The `docker build` command line for one image, run from the repository root.
 * @param {Image} image
 * @param {NodeJS.ProcessEnv} env
 * @param {BuildOptions} options
 * @returns {string[]}
 */
export function dockerBuildCommand(image, env, options) {
  refuseRecipeArgs(options.buildArgs ?? {});
  const recipe = RECIPES[image];
  const command = ['docker', 'build', '-f', recipe.file, '-t', options.tag];
  command.push(
    ...buildArgFlags({
      QUAD_IMAGE_REGISTRY: env.QUAD_IMAGE_REGISTRY ?? '',
      GIT_SHA: env.GIT_SHA ?? '',
      ...recipe.args,
    }),
  );

  const proxy = env.HTTPS_PROXY ?? env.https_proxy;
  if (proxy !== undefined && proxy !== '') {
    // The proxy listens on the host's loopback, which only host networking reaches. The proxy
    // variables are Docker's predefined build args, so they are not kept in the image history.
    command.push('--network', 'host', ...buildArgFlags({ HTTPS_PROXY: proxy, https_proxy: proxy }));
    const noProxy = env.NO_PROXY ?? env.no_proxy;
    if (noProxy !== undefined && noProxy !== '') {
      command.push(...buildArgFlags({ NO_PROXY: noProxy, no_proxy: noProxy }));
    }
  }
  if (isFile(env.NODE_EXTRA_CA_CERTS)) {
    command.push('--secret', `id=proxy_ca,src=${env.NODE_EXTRA_CA_CERTS}`);
  }

  command.push(...buildArgFlags(options.buildArgs ?? {}));
  if (options.push === true) command.push('--push');
  command.push('.');
  return command;
}

/**
 * Parses the CLI arguments.
 * @param {string[]} argv
 * @returns {{ images: Image[], tag: string | undefined, push: boolean, buildArgs: Record<string, string> }}
 */
export function parseBuildArgs(argv) {
  /** @type {string | undefined} */
  let target;
  /** @type {string | undefined} */
  let tag;
  let push = false;
  /** @type {Record<string, string>} */
  const buildArgs = {};
  /** @param {number} i */
  const valueAt = (i) => {
    const value = argv[i + 1];
    if (value === undefined || value === '' || value.startsWith('--')) {
      throw new Error(`${argv[i] ?? ''} needs a value.`);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (arg === '--push') push = true;
    else if (arg === '--tag') {
      tag = valueAt(i);
      i += 1;
    } else if (arg === '--build-arg') {
      const pair = valueAt(i);
      const eq = pair.indexOf('=');
      if (eq <= 0) throw new Error(`--build-arg ${JSON.stringify(pair)} is not K=V.`);
      buildArgs[pair.slice(0, eq)] = pair.slice(eq + 1);
      i += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option ${JSON.stringify(arg)}.`);
    } else if (target !== undefined) {
      throw new Error(
        `Build one image or all, not ${JSON.stringify(target)} and ${JSON.stringify(arg)}.`,
      );
    } else target = arg;
  }
  refuseRecipeArgs(buildArgs);
  if (push && tag === undefined) {
    throw new Error('--push needs --tag <registry/repository:tag>; local tags are never pushed.');
  }

  if (target === undefined) throw new Error('Name an image: api, staff, console, clamav or all.');
  /** @type {Image[]} */
  let images;
  if (target === 'all') {
    if (tag !== undefined) throw new Error('--tag needs a single image, not all.');
    images = [...IMAGES];
  } else {
    const image = IMAGES.find((name) => name === target);
    if (image === undefined) {
      throw new Error(
        `Unknown image ${JSON.stringify(target)} (api, staff, console, clamav, all).`,
      );
    }
    images = [image];
  }
  return { images, tag, push, buildArgs };
}

/** The commit being built, or empty outside a git checkout. */
function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Builds each image in turn and stops at the first failure.
 * @param {ReturnType<typeof parseBuildArgs>} parsed
 * @param {NodeJS.ProcessEnv} env
 * @param {(cmd: string, args: string[]) => { status: number | null, error?: Error }} spawn
 * @param {(line: string) => void} write
 * @returns {number} the exit code
 */
export function runBuilds(parsed, env, spawn, write) {
  for (const image of parsed.images) {
    const [cmd = 'docker', ...args] = dockerBuildCommand(image, env, {
      tag: parsed.tag ?? `quad/${image}:local`,
      push: parsed.push,
      buildArgs: parsed.buildArgs,
    });
    write(`\n=== Building ${image}\n\n`);
    const { status, error } = spawn(cmd, args);
    if (error !== undefined) {
      write(`docker-build: could not run ${cmd}: ${error.message}\n`);
      return 1;
    }
    if (status !== 0) return status ?? 1;
  }
  return 0;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  /** @type {ReturnType<typeof parseBuildArgs>} */
  let parsed;
  try {
    parsed = parseBuildArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.stderr.write(
      'Usage: node scripts/docker-build.mjs <api|staff|console|clamav|all> [--tag <ref>] [--push] [--build-arg K=V]\n',
    );
    process.exit(2);
  }
  const env = { ...process.env, GIT_SHA: process.env.GIT_SHA ?? gitSha() };
  process.exit(
    runBuilds(
      parsed,
      env,
      (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit' }),
      (line) => {
        process.stdout.write(line);
      },
    ),
  );
}
