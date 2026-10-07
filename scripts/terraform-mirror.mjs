#!/usr/bin/env node
// Builds the pinned Terraform toolchain in `.cache/terraform/` from releases.hashicorp.com
// (registry.terraform.io is not reachable everywhere we run Terraform, D28):
//   node scripts/terraform-mirror.mjs              download what is missing and verify everything
//   node scripts/terraform-mirror.mjs --print-env  print the PATH and TF_CLI_CONFIG_FILE exports
//   node scripts/terraform-mirror.mjs --record     re-pin the SHA256SUMS hashes in infra/toolchain.json
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
 * Downloads `url` to `dest` with curl (which honours the proxy), through a temporary file so an
 * interrupted download never looks complete.
 * @param {string} url
 * @param {string} dest
 */
function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const partial = `${dest}.partial`;
  const result = spawnSync('curl', ['-fsSL', '--retry', '3', '-o', partial, url], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    rmSync(partial, { force: true });
    throw new Error(`Download failed (curl exit ${String(result.status)}): ${url}`);
  }
  renameSync(partial, dest);
  process.stdout.write(`downloaded ${url}\n`);
}

/**
 * Makes sure `dest` exists with SHA-256 `expected`, downloading it when it is missing or wrong.
 * @param {string} url
 * @param {string} dest
 * @param {string} expected
 */
function ensureVerified(url, dest, expected) {
  if (existsSync(dest) && sha256File(dest) === expected) return;
  download(url, dest);
  const actual = sha256File(dest);
  if (actual !== expected) {
    rmSync(dest, { force: true });
    throw new Error(`Checksum mismatch for ${url}: expected ${expected}, got ${actual}.`);
  }
}

/**
 * The SHA256SUMS file of one release, checked against its pin and parsed.
 * @param {string} product
 * @param {TerraformPin | ProviderPin} pin
 * @param {string} cacheDir
 * @returns {Map<string, string>}
 */
function verifiedSums(product, pin, cacheDir) {
  if (!/^[0-9a-f]{64}$/.test(pin.sumsSha256)) {
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
 */
function fetchReleaseFile(product, version, sums, name, dest) {
  const expected = sums.get(name);
  if (!expected) throw new Error(`${name} is not listed in the ${product} ${version} SHA256SUMS.`);
  ensureVerified(`${RELEASES}/${product}/${version}/${name}`, dest, expected);
}

/**
 * Downloads every SHA256SUMS file again and writes their hashes into the toolchain file.
 * @param {Toolchain} toolchain
 * @param {string} toolchainPath
 * @param {string} cacheDir
 */
function record(toolchain, toolchainPath, cacheDir) {
  for (const { product, pin } of [
    { product: 'terraform', pin: toolchain.terraform },
    ...toolchain.providers.map((p) => ({ product: providerProduct(p.source), pin: p })),
  ]) {
    const dest = join(cacheDir, 'sums', `${product}_${pin.version}_SHA256SUMS`);
    download(sumsUrl(product, pin.version), dest);
    pin.sumsSha256 = sha256File(dest);
  }
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
 */
function unzipTerraform(zip, binDir) {
  mkdirSync(binDir, { recursive: true });
  const result = spawnSync('unzip', ['-o', '-q', zip, 'terraform', '-d', binDir], {
    stdio: 'inherit',
  });
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
      if (args.includes('--record')) record(toolchain, toolchainPath, cacheDir);
      else build(toolchain, cacheDir);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
