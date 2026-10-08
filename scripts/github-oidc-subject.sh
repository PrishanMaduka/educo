#!/usr/bin/env bash
# Sets this repository's GitHub Actions OIDC subject template once, before any AWS role is used
# (infra/README.md, first deploy step 5). The trust policies in infra/modules/app/oidc.tf and
# infra/envs/global/iam.tf match subjects of the shape
#   repo:<owner>/<name>:environment:staging:ref:refs/heads/main
#   repo:<owner>/<name>:pull_request:ref:refs/pull/<n>/merge
# which GitHub only issues with include_claim_keys ["repo", "context", "ref"], in that order.
# Run by a repository admin with the GitHub CLI signed in; CI never runs it.
#   scripts/github-oidc-subject.sh [owner/name]   (default prishanmaduka/educo)
set -euo pipefail

repo="${1:-prishanmaduka/educo}"

gh api --method PUT "repos/${repo}/actions/oidc/customization/sub" --input - <<'JSON'
{ "use_default": false, "include_claim_keys": ["repo", "context", "ref"] }
JSON

# Prints the stored template, so the person running this can see it took effect.
gh api "repos/${repo}/actions/oidc/customization/sub"
