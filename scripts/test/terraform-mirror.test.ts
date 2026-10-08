import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cliConfig,
  download,
  ensureVerified,
  fetchReleaseFile,
  hostPlatform,
  mirrorZipPath,
  nextPin,
  parseSha256Sums,
  parseToolchain,
  providerZipName,
  sumsUrl,
  unzipTerraform,
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

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe('verified downloads', () => {
  const dirs: string[] = [];
  const scratch = () => {
    const dir = mkdtempSync(join(tmpdir(), 'quad-mirror-'));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  /** A downloader that writes `body` and records each URL it was asked for. */
  const fakeDownload = (body: string) => {
    const urls: string[] = [];
    const fetch = (url: string, path: string) => {
      urls.push(url);
      writeFileSync(path, body);
    };
    return { urls, fetch };
  };

  it('does not download a cached file that already matches', () => {
    const dest = join(scratch(), 'terraform.zip');
    writeFileSync(dest, 'good');
    const { urls, fetch } = fakeDownload('good');
    ensureVerified('https://x/terraform.zip', dest, sha256('good'), fetch);
    expect(urls).toEqual([]);
  });

  it('downloads a missing file and keeps it when it matches', () => {
    const dest = join(scratch(), 'sub/terraform.zip');
    const { urls, fetch } = fakeDownload('good');
    ensureVerified('https://x/terraform.zip', dest, sha256('good'), fetch);
    expect(urls).toEqual(['https://x/terraform.zip']);
    expect(readFileSync(dest, 'utf8')).toBe('good');
  });

  it('refuses a tampered download and leaves nothing behind', () => {
    const dir = scratch();
    const dest = join(dir, 'terraform.zip');
    writeFileSync(dest, 'stale');
    const { fetch } = fakeDownload('tampered');
    expect(() => {
      ensureVerified('https://x/terraform.zip', dest, sha256('good'), fetch);
    }).toThrow(/Checksum mismatch/);
    expect(existsSync(dest)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it.each(['', 'not-a-hash', 'A'.repeat(64), 'a'.repeat(63)])(
    'refuses the pin %j before downloading',
    (pin) => {
      const { urls, fetch } = fakeDownload('good');
      expect(() => {
        ensureVerified('https://x/f', join(scratch(), 'f'), pin, fetch);
      }).toThrow(/64 lowercase hex/);
      expect(urls).toEqual([]);
    },
  );

  it('refuses a file that its SHA256SUMS does not list', () => {
    const { urls, fetch } = fakeDownload('good');
    const sums = new Map([['other.zip', sha256('good')]]);
    expect(() => {
      fetchReleaseFile(
        'terraform',
        '1.16.5',
        sums,
        'terraform_1.16.5_linux_amd64.zip',
        join(scratch(), 'z'),
        fetch,
      );
    }).toThrow(/terraform_1\.16\.5_linux_amd64\.zip is not listed/);
    expect(urls).toEqual([]);
  });

  it('fetches a listed file from its release URL', () => {
    const { urls, fetch } = fakeDownload('good');
    const sums = new Map([['terraform_1.16.5_linux_amd64.zip', sha256('good')]]);
    fetchReleaseFile(
      'terraform',
      '1.16.5',
      sums,
      'terraform_1.16.5_linux_amd64.zip',
      join(scratch(), 'z'),
      fetch,
    );
    expect(urls).toEqual([
      'https://releases.hashicorp.com/terraform/1.16.5/terraform_1.16.5_linux_amd64.zip',
    ]);
  });

  it('downloads with curl over HTTPS only, with retries', () => {
    const calls: string[][] = [];
    download('https://x/f', join(scratch(), 'f'), (cmd, args) => {
      calls.push([cmd, ...args]);
      return { status: 0 };
    });
    expect(calls[0]?.slice(0, 6)).toEqual(['curl', '-fsSL', '--proto', '=https', '--retry', '3']);
  });

  it('removes a partial file when curl fails', () => {
    const path = join(scratch(), 'f');
    expect(() => {
      download('https://x/f', path, () => {
        writeFileSync(path, 'half');
        return { status: 22 };
      });
    }).toThrow(/curl exit 22/);
    expect(existsSync(path)).toBe(false);
  });
});

describe('nextPin', () => {
  const oldPin = 'a'.repeat(64);
  const newPin = 'b'.repeat(64);

  it.each(['', 'not-recorded'])('records a hash where the pin is %j', (current) => {
    expect(nextPin('terraform 1.16.5', current, newPin, false)).toBe(newPin);
  });

  it('keeps an unchanged pin', () => {
    expect(nextPin('terraform 1.16.5', oldPin, oldPin, false)).toBe(oldPin);
  });

  it('refuses to replace a different pin without --force, naming both values', () => {
    expect(() => nextPin('terraform 1.16.5', oldPin, newPin, false)).toThrow(
      new RegExp(`terraform 1\\.16\\.5.*${oldPin}.*${newPin}.*--force`),
    );
  });

  it('replaces a different pin with --force', () => {
    expect(nextPin('terraform 1.16.5', oldPin, newPin, true)).toBe(newPin);
  });
});

describe('unzipTerraform', () => {
  it('says unzip is required when it cannot be started', () => {
    const missing = () => ({ status: null, error: new Error('spawnSync unzip ENOENT') });
    expect(() => {
      unzipTerraform('/z.zip', join(tmpdir(), 'quad-unzip-bin'), missing);
    }).toThrow(/unzip is required/);
  });

  it('reports a failed extraction', () => {
    expect(() => {
      unzipTerraform('/z.zip', join(tmpdir(), 'quad-unzip-bin'), () => ({ status: 9 }));
    }).toThrow(/unzip \/z\.zip failed/);
  });
});
