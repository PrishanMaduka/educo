#!/usr/bin/env node
// Builds the pinned Terraform toolchain in `.cache/terraform/` from releases.hashicorp.com
// (registry.terraform.io is not reachable everywhere we run Terraform, D28):
//   node scripts/terraform-mirror.mjs              download what is missing and verify everything
//   node scripts/terraform-mirror.mjs --print-env  print the PATH and TF_CLI_CONFIG_FILE exports
//   node scripts/terraform-mirror.mjs --record     pin the SHA256SUMS hashes in infra/toolchain.json
//                                                  (add --force to replace a pin that changed)
// Each SHA256SUMS file must match the hash pinned in `infra/toolchain.json`, and each zip must
// match its line in that SHA256SUMS file, so a tampered download fails before it is used.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** @typedef {{ version: string, sumsSha256: string }} TerraformPin */
/** @typedef {{ source: string, version: string, sumsSha256: string }} ProviderPin */
/** @typedef {{ terraform: TerraformPin, providers: ProviderPin[], platforms: string[] }} Toolchain */

const RELEASES = 'https://releases.hashicorp.com';

/** Node's `process.platform`/`process.arch` → HashiCorp's `<os>_<arch>`. */
const PLATFORMS = new Map([
  ['linux/x64', 'linux_amd64'],
  ['linux/arm64', 'linux_arm64'],
  ['darwin/x64', 'darwin_amd64'],
  ['darwin/arm64', 'darwin_arm64'],
]);

/**
 * Parses a `SHA256SUMS` file (`<hash>  <file name>` per line) into file name → hash.
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseSha256Sums(text) {
  /** @type {Map<string, string>} */
  const sums = new Map();
  for (const line of text.split('\n')) {
    const match = /^([0-9a-fA-F]+)\s+\*?(\S+)\s*$/.exec(line.trim());
    if (match?.[1] && match[2]) sums.set(match[2], match[1]);
  }
  return sums;
}

/**
 * The HashiCorp platform name for this machine; throws for one we do not mirror.
 * @param {NodeJS.Platform} platform
 * @param {string} arch
 * @returns {string}
 */
export function hostPlatform(platform, arch) {
  const name = PLATFORMS.get(`${platform}/${arch}`);
  if (!name) throw new Error(`No Terraform build is mirrored for ${platform}/${arch}.`);
  return name;
}

/**
 * @param {string} type provider type, such as `aws`
 * @param {string} version
 * @param {string} platform
 */
export function providerZipName(type, version, platform) {
  return `terraform-provider-${type}_${version}_${platform}.zip`;
}

/**
 * Where a provider zip goes in Terraform's packed filesystem-mirror layout.
 * @param {string} mirrorDir
 * @param {string} source `<namespace>/<type>`, such as `hashicorp/aws`
 * @param {string} version
 * @param {string} platform
 */
export function mirrorZipPath(mirrorDir, source, version, platform) {
  const [namespace = '', type = ''] = source.split('/');
  return join(
    mirrorDir,
    'registry.terraform.io',
    namespace,
    type,
    providerZipName(type, version, platform),
  );
}

/**
 * The SHA256SUMS URL of a HashiCorp release (`product` is `terraform` or `terraform-provider-<type>`).
 * @param {string} product
 * @param {string} version
 */
export function sumsUrl(product, version) {
  return `${RELEASES}/${product}/${version}/${product}_${version}_SHA256SUMS`;
}

/**
 * The Terraform CLI config: hashicorp providers come only from the mirror. There is deliberately no
 * `direct` block, so a provider missing from the mirror fails `init` instead of reaching a registry.
 * @param {string} mirrorDir
 * @returns {string}
 */
export function cliConfig(mirrorDir) {
  return [
    'disable_checkpoint = true',
    '',
    'provider_installation {',
    '  filesystem_mirror {',
    `    path    = ${JSON.stringify(mirrorDir)}`,
    '    include = ["registry.terraform.io/hashicorp/*"]',
    '  }',
    '}',
    '',
  ].join('\n');
}

/** @type {(value: unknown) => value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** @type {(value: unknown, keys: string[]) => boolean} */
const hasStrings = (value, keys) =>
  isRecord(value) && keys.every((key) => typeof value[key] === 'string');

/**
 * Checks the shape of `infra/toolchain.json`.
 * @param {unknown} json
 * @returns {Toolchain}
 */
export function parseToolchain(json) {
  if (
    isRecord(json) &&
    hasStrings(json.terraform, ['version', 'sumsSha256']) &&
    Array.isArray(json.providers) &&
    json.providers.every((p) => hasStrings(p, ['source', 'version', 'sumsSha256'])) &&
    Array.isArray(json.platforms) &&
    json.platforms.every((p) => typeof p === 'string')
  ) {
    return /** @type {Toolchain} */ (json);
  }
  throw new Error('infra/toolchain.json does not have the expected toolchain shape.');
}

/** @param {string} path */
const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/**
 * Runs a command synchronously; `spawnSync` by default, injected in tests.
 * @typedef {(cmd: string, args: string[], options: import('node:child_process').SpawnSyncOptions)
 *   => { status: number | null, error?: Error }} Runner
 */
/** Writes the file at `url` to `path`, or throws. @typedef {(url: string, path: string) => void} Downloader */

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Downloads `url` to `path` with curl (which honours the proxy), HTTPS only, removing whatever it
 * wrote when the download fails.
 * @param {string} url
 * @param {string} path
 * @param {Runner} [run]
 */
export function download(url, path, run = spawnSync) {
  mkdirSync(dirname(path), { recursive: true });
  const result = run('curl', ['-fsSL', '--proto', '=https', '--retry', '3', '-o', path, url], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    rmSync(path, { force: true });
    throw new Error(`Download failed (curl exit ${String(result.status)}): ${url}`);
  }
}

/**
 * Makes sure `dest` exists with SHA-256 `expected`. A missing or different file is downloaded to
 * `<dest>.partial`, checked there and only then moved into place, so `dest` never holds a file
 * that failed its check.
 * @param {string} url
 * @param {string} dest
 * @param {string} expected
 * @param {Downloader} [fetch]
 */
export function ensureVerified(url, dest, expected, fetch = download) {
  if (!SHA256_HEX.test(expected)) {
    throw new Error(`The SHA-256 pinned for ${url} is not 64 lowercase hex characters.`);
  }
  if (existsSync(dest) && sha256File(dest) === expected) return;
  rmSync(dest, { force: true });
  const partial = `${dest}.partial`;
  mkdirSync(dirname(dest), { recursive: true });
  fetch(url, partial);
  const actual = sha256File(partial);
  if (actual !== expected) {
    rmSync(partial, { force: true });
    throw new Error(`Checksum mismatch for ${url}: expected ${expected}, got ${actual}.`);
  }
  renameSync(partial, dest);
  process.stdout.write(`downloaded and verified ${url}\n`);
}

/**
 * The pin to record for `label` when its SHA256SUMS now hashes to `observed`. A recorded pin that
 * differs is a changed release file or a tampered download, so it is replaced only with `--force`.
 * @param {string} label
 * @param {string} current
 * @param {string} observed
 * @param {boolean} force
 * @returns {string}
 */
export function nextPin(label, current, observed, force) {
  if (!SHA256_HEX.test(current) || current === observed || force) return observed;
  throw new Error(
    `${label}: the pinned SHA256SUMS hash is ${current}, but the download hashes to ${observed}. ` +
      'Check why it changed, then re-run with --record --force to replace the pin.',
  );
}

/**
 * The SHA256SUMS file of one release, checked against its pin and parsed.
 * @param {string} product
 * @param {TerraformPin | ProviderPin} pin
 * @param {string} cacheDir
 * @returns {Map<string, string>}
 */
function verifiedSums(product, pin, cacheDir) {
  if (!SHA256_HEX.test(pin.sumsSha256)) {
    throw new Error(
      `${product} ${pin.version} has no recorded sumsSha256; run with --record once.`,
    );
  }
  const path = join(cacheDir, 'sums', `${product}_${pin.version}_SHA256SUMS`);
  ensureVerified(sumsUrl(product, pin.version), path, pin.sumsSha256);
  return parseSha256Sums(readFileSync(path, 'utf8'));
}

/**
 * Downloads release file `name` of `product` to `dest`, verified against its SHA256SUMS line.
 * @param {string} product
 * @param {string} version
 * @param {Map<string, string>} sums
 * @param {string} name
 * @param {string} dest
 * @param {Downloader} [fetch]
 */
export function fetchReleaseFile(product, version, sums, name, dest, fetch = download) {
  const expected = sums.get(name);
  if (!expected) throw new Error(`${name} is not listed in the ${product} ${version} SHA256SUMS.`);
  ensureVerified(`${RELEASES}/${product}/${version}/${name}`, dest, expected, fetch);
}

/**
 * Downloads every SHA256SUMS file again and writes their hashes into the toolchain file. A pin that
 * would change is refused (and nothing is written) unless `force` is set.
 * @param {Toolchain} toolchain
 * @param {string} toolchainPath
 * @param {string} cacheDir
 * @param {boolean} force
 */
function record(toolchain, toolchainPath, cacheDir, force) {
  let changed = false;
  for (const { product, pin } of [
    { product: 'terraform', pin: toolchain.terraform },
    ...toolchain.providers.map((p) => ({ product: providerProduct(p.source), pin: p })),
  ]) {
    const dest = join(cacheDir, 'sums', `${product}_${pin.version}_SHA256SUMS`);
    rmSync(dest, { force: true });
    download(sumsUrl(product, pin.version), dest);
    const observed = sha256File(dest);
    const next = nextPin(`${product} ${pin.version}`, pin.sumsSha256, observed, force);
    changed ||= next !== pin.sumsSha256;
    pin.sumsSha256 = next;
  }
  if (!changed) {
    process.stdout.write(`every SHA256SUMS hash already matches ${toolchainPath}\n`);
    return;
  }
  // Prettier (the edit hook or `pnpm format`) restores the repository's JSON layout afterwards.
  writeFileSync(toolchainPath, `${JSON.stringify(toolchain, null, 2)}\n`);
  process.stdout.write(`recorded SHA256SUMS hashes in ${toolchainPath}\n`);
}

/** @param {string} source `<namespace>/<type>` */
const providerProduct = (source) => `terraform-provider-${source.split('/')[1] ?? ''}`;

/**
 * Builds the binary and the provider mirror (the lock-file platforms plus this machine's),
 * verifying every file against the pins.
 * @param {Toolchain} toolchain
 * @param {string} cacheDir
 */
function build(toolchain, cacheDir) {
  const host = hostPlatform(process.platform, process.arch);

  const { version } = toolchain.terraform;
  const terraformSums = verifiedSums('terraform', toolchain.terraform, cacheDir);
  const zipName = `terraform_${version}_${host}.zip`;
  const zip = join(cacheDir, 'zips', zipName);
  fetchReleaseFile('terraform', version, terraformSums, zipName, zip);
  unzipTerraform(zip, join(cacheDir, 'bin'));

  const mirrorDir = join(cacheDir, 'mirror');
  for (const pin of toolchain.providers) {
    const product = providerProduct(pin.source);
    const sums = verifiedSums(product, pin, cacheDir);
    const type = pin.source.split('/')[1] ?? '';
    for (const platform of new Set([...toolchain.platforms, host])) {
      const name = providerZipName(type, pin.version, platform);
      const dest = mirrorZipPath(mirrorDir, pin.source, pin.version, platform);
      fetchReleaseFile(product, pin.version, sums, name, dest);
    }
  }

  writeFileSync(join(cacheDir, 'terraformrc'), cliConfig(mirrorDir));
  process.stdout.write(`Terraform ${version} and its providers are verified in ${cacheDir}\n`);
}

/**
 * Extracts the verified zip's `terraform` binary into `binDir`.
 * @param {string} zip
 * @param {string} binDir
 * @param {Runner} [run]
 */
export function unzipTerraform(zip, binDir, run = spawnSync) {
  mkdirSync(binDir, { recursive: true });
  const result = run('unzip', ['-o', '-q', zip, 'terraform', '-d', binDir], { stdio: 'inherit' });
  if (result.error || result.status === null) {
    throw new Error(
      `unzip is required to extract Terraform (${result.error?.message ?? 'it was killed'}).`,
    );
  }
  if (result.status !== 0) throw new Error(`unzip ${zip} failed.`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const cacheDir = join(root, '.cache', 'terraform');
  const toolchainPath = join(root, 'infra', 'toolchain.json');
  const args = process.argv.slice(2);
  try {
    if (args.includes('--print-env')) {
      const bin = join(cacheDir, 'bin');
      const rc = join(cacheDir, 'terraformrc');
      process.stdout.write(`export PATH="${bin}:$PATH"\nexport TF_CLI_CONFIG_FILE="${rc}"\n`);
    } else {
      const toolchain = parseToolchain(JSON.parse(readFileSync(toolchainPath, 'utf8')));
      if (args.includes('--record')) {
        record(toolchain, toolchainPath, cacheDir, args.includes('--force'));
      } else build(toolchain, cacheDir);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
