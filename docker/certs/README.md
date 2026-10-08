# Certificates in the images

No certificate files are committed here.

- **Amazon RDS CA bundle.** The api image downloads
  `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem` with `ADD --checksum` (the
  pinned SHA-256 is in `docker/api.Dockerfile`) to `/app/certs/rds-global-bundle.pem`. The migrate
  and seed tasks set `NODE_EXTRA_CA_CERTS` to that path. When AWS publishes a new bundle, the build
  fails on the checksum: download the new file, check it, and update the pin.
- **A proxy's CA for builds.** Behind a TLS-intercepting proxy, `scripts/docker-build.mjs` passes the
  file named by `NODE_EXTRA_CA_CERTS` as the BuildKit secret `proxy_ca`. Only the `RUN` steps that
  download mount it (at `/run/secrets/proxy_ca`), so it is never written to an image layer. The
  proxy variables are Docker's predefined build args and are not kept in the image either.
