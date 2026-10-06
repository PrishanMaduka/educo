#!/usr/bin/env bash
# SessionStart hook for Claude Code cloud sessions: Docker, pnpm deps, Flutter on PATH,
# image registry mirror and local services. Idempotent. Never fails the session.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

log() { echo "[session-start] $*" >&2; }
trap 'log "unexpected error on line $LINENO; continuing"; exit 0' ERR

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

# 1. Docker daemon (not running by default in new containers).
if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    if command -v dockerd >/dev/null 2>&1; then
      log "starting dockerd"
      (dockerd >/tmp/dockerd.log 2>&1 &) || true
      for _ in $(seq 1 20); do
        docker info >/dev/null 2>&1 && break
        sleep 1
      done
    else
      log "dockerd not installed"
    fi
  fi
  docker info >/dev/null 2>&1 || log "docker is not available"
fi

# 2. pnpm via corepack, then dependencies.
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || log "corepack enable failed"
fi
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile >&2 || log "pnpm install failed"
fi

# 3. Environment for later commands.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  if [ -d /opt/sdk/flutter/bin ]; then
    echo 'export PATH="/opt/sdk/flutter/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
  fi
  # Docker Hub is rate-limited in the cloud container; pull through the mirror.
  echo 'export QUAD_IMAGE_REGISTRY=mirror.gcr.io/' >>"$CLAUDE_ENV_FILE"
fi
export QUAD_IMAGE_REGISTRY=mirror.gcr.io/

# 4. Local services (only what the cloud container needs).
if [ -f docker-compose.yml ] && docker info >/dev/null 2>&1; then
  docker compose up -d postgres redis mailpit >&2 || log "docker compose up failed"
fi

exit 0
