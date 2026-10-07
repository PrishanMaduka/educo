# The ClamAV image (quad/clamav): the official image with Quad's clamd and freshclam settings,
# run fully as the clamav user through the image's own /init-unprivileged.
# Build with `node scripts/docker-build.mjs clamav`. It keeps the official HEALTHCHECK
# (clamdcheck.sh: PING on 127.0.0.1:3310). Both daemons log to stdout.

# Empty means Docker Hub; set a mirror host with a trailing slash (for example `mirror.gcr.io/`).
# The base image is pinned by digest (the multi-platform index); the tag is only for people.
ARG QUAD_IMAGE_REGISTRY=
FROM ${QUAD_IMAGE_REGISTRY}clamav/clamav:1.4.6@sha256:57deb108fc4c72778aa83eafbca7bb7153e28c3f57c005afd38d31f16da86f23
COPY --chmod=0644 docker/clamav/clamd.conf /etc/clamav/clamd.conf
COPY --chmod=0644 docker/clamav/freshclam.conf /etc/clamav/freshclam.conf
# The signature database and the log and run folders belong to clamav, so nothing needs root.
RUN install -d -o clamav -g clamav /run/clamav \
    && chown -R clamav:clamav /var/lib/clamav /var/log/clamav
# /init-unprivileged starts freshclam with `--checks=${FRESHCLAM_CHECKS:-1}`, which overrides
# `Checks` in freshclam.conf, so the same value is set here.
ENV FRESHCLAM_CHECKS=12
USER clamav
EXPOSE 3310
ENTRYPOINT ["/init-unprivileged"]
# Last, so a new commit does not invalidate the layers above.
ARG GIT_SHA=
LABEL org.opencontainers.image.title="quad-clamav" \
      org.opencontainers.image.revision="${GIT_SHA}"
