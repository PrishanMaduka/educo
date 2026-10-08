import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repo = (rel: string) => resolve(dirname(fileURLToPath(import.meta.url)), '../..', rel);
const script = readFileSync(repo('scripts/github-oidc-subject.sh'), 'utf8');

// The subjects the AWS trust policies accept (infra/modules/app/oidc.tf, infra/envs/global/iam.tf).
const trusted = [
  ...readFileSync(repo('infra/modules/app/oidc.tf'), 'utf8').matchAll(/sub = "(repo:[^"]+)"/g),
  ...readFileSync(repo('infra/envs/global/iam.tf'), 'utf8').matchAll(/= "(repo:[^"]+)"/g),
].map((match) => match[1] ?? '');

describe('github-oidc-subject.sh', () => {
  it('sets the repo, context and ref claim keys, in that order', () => {
    const body = /--input - <<'JSON'\n(.+)\nJSON/.exec(script)?.[1] ?? '';
    expect(JSON.parse(body)).toEqual({
      use_default: false,
      include_claim_keys: ['repo', 'context', 'ref'],
    });
  });

  it('targets this repository by default and fails on the first error', () => {
    expect(script).toContain('repo="${1:-prishanmaduka/educo}"');
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('repos/${repo}/actions/oidc/customization/sub');
  });

  it('matches the subject shape every AWS trust policy expects', () => {
    expect(trusted.length).toBeGreaterThanOrEqual(4);
    for (const subject of trusted) {
      // repo:<owner/name>:<context>:ref:<ref>, where context is environment:<env> or pull_request.
      expect(subject).toMatch(/^repo:[^:]+:(environment:[^:]+|pull_request):ref:refs\/.+$/);
    }
  });
});
