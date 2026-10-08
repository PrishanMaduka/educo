# The api image (quad/api): the API by default, and the worker and one-off commands of the same
# image (spec 20, D28):
#   node dist/worker.js | dist/migrate.js | dist/seed.js | dist/db-bootstrap.js
#   | dist/worker-health.js | dist/sentry-test.js
# Build it with `node scripts/docker-build.mjs api` from the repository root.
#
# RUN steps that download mount the proxy's CA (BuildKit secret `proxy_ca`, optional) and point
# NODE_EXTRA_CA_CERTS at it; the proxy variables are Docker's predefined build args. Neither is kept
# in any image layer.

# Empty means Docker Hub; set a mirror host with a trailing slash (for example `mirror.gcr.io/`).
# Base images are pinned by digest (the multi-platform index); the tag is only for people.
ARG QUAD_IMAGE_REGISTRY=

FROM ${QUAD_IMAGE_REGISTRY}library/node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_HOME=/corepack \
    npm_config_store_dir=/pnpm/store \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=/pnpm:$PATH
WORKDIR /repo
# pnpm comes from the root `packageManager` field.
COPY package.json ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca corepack enable pnpm \
    && NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca corepack install

# Every package in the lockfile, fetched into the store; changes only with the lockfile.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=secret,id=proxy_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca pnpm fetch

FROM deps AS build
COPY . .
# Only the api and the workspace packages it bundles are installed.
RUN pnpm install --offline --frozen-lockfile --filter "@quad/api..." \
    && pnpm --filter @quad/api build
# The production dependencies only (the @quad/* packages are bundled into dist). `deploy`
# re-resolves package metadata, so it may reach the registry.
# pnpm 9's deploy resolves again rather than reusing the lockfile, so the deployed versions are
# checked against pnpm-lock.yaml and the build fails on any drift.
RUN --mount=type=secret,id=proxy_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca pnpm --filter @quad/api deploy --prod /out \
    && node scripts/check-deployed-lock.mjs pnpm-lock.yaml /out/node_modules/.pnpm

FROM ${QUAD_IMAGE_REGISTRY}library/node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime
ENV NODE_ENV=production
# The runtime needs only node: drop npm, npx, corepack and yarn (smaller, fewer scanner findings).
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* \
    && mkdir -p /app/certs
WORKDIR /app
# Amazon RDS CA bundle (all regions); the migrate and seed tasks set NODE_EXTRA_CA_CERTS to it.
# Update the checksum when AWS publishes a new bundle. /app/certs is created above because ADD
# would give a folder it creates the file's --chmod (0444), which the node user cannot enter.
ADD --checksum=sha256:fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c \
    --chmod=0444 \
    https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
# Owned by root and read-only to the node user. `dist/` is copied straight from the build; from the
# deploy folder only the manifest and the production node_modules are taken.
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
# ECS runs the root file system read-only; Fargate fills an ephemeral volume from the image only
# at a path the image declares as a VOLUME (D28). Nothing may write here after this line.
VOLUME ["/tmp"]
USER node
EXPOSE 4000
# The API's liveness probe. The worker service overrides it with `node dist/worker-health.js`.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/v1/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/main.js"]
# Last, so a new commit does not invalidate the layers above.
ARG GIT_SHA=
LABEL org.opencontainers.image.title="quad-api" \
      org.opencontainers.image.revision="${GIT_SHA}"
