# The staff and console images (quad/staff, quad/console): the Next.js standalone server.
# Build with `node scripts/docker-build.mjs staff|console`, which sets APP and PORT.
#
# NEXT_PUBLIC_* values are compiled into the browser bundle at build time, so M0b builds the web
# images per environment (D28). Everything else (APP_ENV, SENTRY_DSN, OTEL_*) is read at runtime.
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
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
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
ARG APP
COPY . .
RUN test "${APP}" = staff || test "${APP}" = console
RUN pnpm install --offline --frozen-lockfile --filter "@quad/${APP}..."
# Declared just before the build, so different public values reuse the install layers above.
ARG NEXT_PUBLIC_APP_ENV=
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
# next/font downloads the Google font files during the build. `public/` is optional, so an empty
# one is created for the COPY below.
RUN --mount=type=secret,id=proxy_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca pnpm --filter "@quad/${APP}" build \
    && mkdir -p "apps/${APP}/public"

FROM ${QUAD_IMAGE_REGISTRY}library/node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime
ARG APP
ARG PORT=3000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=${PORT}
# The runtime needs only node: drop npm, npx, corepack and yarn (smaller, fewer scanner findings).
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
WORKDIR /app
# The server is owned by root and read-only to the node user. Only `.next/cache` (image
# optimisation and the data cache) is writable; without it `/_next/image` fails with EACCES.
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build /repo/apps/${APP}/public ./apps/${APP}/public
RUN mkdir -p "apps/${APP}/.next/cache" && chown node:node "apps/${APP}/.next/cache"
# The exec-form CMD cannot expand APP, so the working directory is the app's folder and the
# command is that folder's server.js (`apps/<app>/server.js`).
WORKDIR /app/apps/${APP}
USER node
EXPOSE ${PORT}
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
# Last, so a new commit does not invalidate the layers above.
ARG GIT_SHA=
LABEL org.opencontainers.image.title="quad-${APP}" \
      org.opencontainers.image.revision="${GIT_SHA}"
