import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  cliConfig,
  hostPlatform,
  mirrorZipPath,
  parseSha256Sums,
  parseToolchain,
  providerZipName,
  sumsUrl,
} from '../terraform-mirror.mjs';

const repo = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));
const toolchain = parseToolchain(JSON.parse(readFileSync(repo('infra/toolchain.json'), 'utf8')));

/** Every `versions.tf` under `infra/`, skipping `.terraform` working directories. */
const versionFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '.terraform' ? [] : versionFiles(path);
    return entry.name === 'versions.tf' ? [path] : [];
  });

describe('parseSha256Sums', () => {
  it('maps each file name to its hash', () => {
    expect(parseSha256Sums('abc  terraform_1.16.5_linux_amd64.zip\n')).toEqual(
      new Map([['terraform_1.16.5_linux_amd64.zip', 'abc']]),
    );
  });

  it('ignores blank lines and keeps every entry', () => {
    const sums = parseSha256Sums('aa  one.zip\n\nbb  two.zip\n');
    expect([...sums.entries()]).toEqual([
      ['one.zip', 'aa'],
      ['two.zip', 'bb'],
    ]);
  });
});

describe('hostPlatform', () => {
  it.each([
    ['linux', 'x64', 'linux_amd64'],
    ['linux', 'arm64', 'linux_arm64'],
    ['darwin', 'x64', 'darwin_amd64'],
    ['darwin', 'arm64', 'darwin_arm64'],
  ] as const)('%s/%s → %s', (platform, arch, expected) => {
    expect(hostPlatform(platform, arch)).toBe(expected);
  });

  it('throws for a platform Terraform is not mirrored for', () => {
    expect(() => hostPlatform('win32', 'x64')).toThrow(/win32/);
  });
});

describe('mirror layout', () => {
  it('names provider zips the way releases.hashicorp.com does', () => {
    expect(providerZipName('aws', '6.67.0', 'linux_amd64')).toBe(
      'terraform-provider-aws_6.67.0_linux_amd64.zip',
    );
  });

  it('places zips in the packed filesystem-mirror layout', () => {
    expect(mirrorZipPath('/m', 'hashicorp/aws', '6.67.0', 'linux_amd64')).toBe(
      '/m/registry.terraform.io/hashicorp/aws/terraform-provider-aws_6.67.0_linux_amd64.zip',
    );
  });

  it('builds the SHA256SUMS URLs on releases.hashicorp.com', () => {
    expect(sumsUrl('terraform', '1.16.5')).toBe(
      'https://releases.hashicorp.com/terraform/1.16.5/terraform_1.16.5_SHA256SUMS',
    );
    expect(sumsUrl('terraform-provider-random', '3.9.1')).toBe(
      'https://releases.hashicorp.com/terraform-provider-random/3.9.1/terraform-provider-random_3.9.1_SHA256SUMS',
    );
  });
});

describe('cliConfig', () => {
  it('installs hashicorp providers only from the filesystem mirror', () => {
    const config = cliConfig('/m');
    expect(config).toContain('filesystem_mirror');
    expect(config).toContain('path    = "/m"');
    expect(config).toContain('"registry.terraform.io/hashicorp/*"');
    expect(config).not.toContain('direct');
  });
});

describe('infra/toolchain.json', () => {
  it('pins Terraform, the two providers and the lock-file platforms', () => {
    expect(toolchain.terraform.version).toBe('1.16.5');
    expect(toolchain.providers.map((p) => `${p.source}@${p.version}`)).toEqual([
      'hashicorp/aws@6.67.0',
      'hashicorp/random@3.9.1',
    ]);
    expect(toolchain.platforms).toEqual(['linux_amd64', 'darwin_arm64']);
  });

  it('records a SHA-256 for every SHA256SUMS file', () => {
    for (const pin of [toolchain.terraform, ...toolchain.providers]) {
      expect(pin.sumsSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('matches infra/.terraform-version', () => {
    expect(readFileSync(repo('infra/.terraform-version'), 'utf8').trim()).toBe(
      toolchain.terraform.version,
    );
  });

  it('rejects a malformed toolchain', () => {
    expect(() => parseToolchain({ terraform: { version: '1.16.5' } })).toThrow(/toolchain/);
  });
});

describe('infra/**/versions.tf', () => {
  const pins = new Map(toolchain.providers.map((p) => [p.source, p.version]));

  // Passes while infra/ has no Terraform yet (Tasks 8–13 add it); each file is named on failure.
  it('pins Terraform and every provider to infra/toolchain.json', () => {
    for (const path of versionFiles(repo('infra'))) {
      const name = relative(repo(''), path);
      const text = readFileSync(path, 'utf8');
      expect(/required_version\s*=\s*"([^"]+)"/.exec(text)?.[1], name).toBe(
        toolchain.terraform.version,
      );
      // Each `name = { source = "…", version = "…" }` entry inside required_providers.
      const providers = [...text.matchAll(/\{[^{}]*\bsource\s*=\s*"([^"]+)"[^{}]*\}/g)].map(
        ([block, source = '']) => ({
          source,
          version: /\bversion\s*=\s*"([^"]+)"/.exec(block)?.[1],
        }),
      );
      expect(providers.length, `${name} declares no providers`).toBeGreaterThan(0);
      for (const { source, version } of providers) {
        expect(pins.has(source), `${name}: ${source} is not in infra/toolchain.json`).toBe(true);
        expect(version, `${name}: ${source}`).toBe(pins.get(source));
      }
    }
  });

  it('reads versions.tf files from every level, skipping .terraform', () => {
    const dir = mkdtempSync(join(tmpdir(), 'quad-versions-'));
    mkdirSync(join(dir, 'modules/app/.terraform'), { recursive: true });
    writeFileSync(join(dir, 'versions.tf'), '');
    writeFileSync(join(dir, 'modules/app/versions.tf'), '');
    writeFileSync(join(dir, 'modules/app/.terraform/versions.tf'), '');
    expect(
      versionFiles(dir)
        .map((p) => relative(dir, p))
        .sort(),
    ).toEqual(['modules/app/versions.tf', 'versions.tf']);
    rmSync(dir, { recursive: true });
  });
});
