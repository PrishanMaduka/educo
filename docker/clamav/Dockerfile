# The ClamAV image (quad/clamav): the official image with Quad's clamd and freshclam settings.
# Build with `node scripts/docker-build.mjs clamav`. The image keeps its own user handling: /init
# starts as root only to prepare /var/lib/clamav and the log and run folders, then clamd and
# freshclam run as the clamav user (`User clamav`, `DatabaseOwner clamav`). It keeps the official
# HEALTHCHECK (clamdcheck.sh), which waits for the first signature download.

# Empty means Docker Hub; set a mirror host with a trailing slash (for example `mirror.gcr.io/`).
ARG QUAD_IMAGE_REGISTRY=
FROM ${QUAD_IMAGE_REGISTRY}clamav/clamav:1.4
ARG GIT_SHA=
LABEL org.opencontainers.image.title="quad-clamav" \
      org.opencontainers.image.revision="${GIT_SHA}"
COPY --chmod=0644 docker/clamav/clamd.conf /etc/clamav/clamd.conf
COPY --chmod=0644 docker/clamav/freshclam.conf /etc/clamav/freshclam.conf
# The official /init starts freshclam with `--checks=${FRESHCLAM_CHECKS:-1}`, which overrides
# `Checks` in freshclam.conf, so the same value is set here.
ENV FRESHCLAM_CHECKS=12
EXPOSE 3310
