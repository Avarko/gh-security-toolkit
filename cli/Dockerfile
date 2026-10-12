# syntax=docker/dockerfile:1.7

# CI provides build-args for tool versions to yield reproducible, non-flaky builds
ARG TRIVY_VER
ARG TRUFFLEHOG_VER
ARG COSIGN_VER
ARG CRANE_VER
ARG HELPER_VER

FROM cgr.dev/chainguard/wolfi-base:latest

ARG TARGETPLATFORM
ARG TARGETARCH
ARG TARGETOS

# No python3: it was here only to serve VEX Hub (see below), and it was the
# largest source of known vulnerabilities in the base packages.
RUN apk update && apk add --no-cache \
    bash ca-certificates curl jq git \
    && update-ca-certificates

RUN adduser -D -u 10001 ghst \
    && mkdir -p /home/ghst \
    && chown -R ghst:ghst /home/ghst

RUN echo "TARGETPLATFORM=${TARGETPLATFORM}, TARGETARCH=${TARGETARCH}, TARGETOS=${TARGETOS}"

# Pre-verified binaries copied from CI
COPY --chown=ghst:ghst verified-binaries/linux-${TARGETARCH}/trivy      /usr/local/bin/trivy
COPY --chown=ghst:ghst verified-binaries/linux-${TARGETARCH}/trufflehog /usr/local/bin/trufflehog
COPY --chown=ghst:ghst verified-binaries/linux-${TARGETARCH}/cosign     /usr/local/bin/cosign
COPY --chown=ghst:ghst verified-binaries/linux-${TARGETARCH}/crane      /usr/local/bin/crane

# Cosign TUF cache (for offline use)
# CI provides verified-binaries/tuf-cache.tgz containing .sigstore/ + cosign-init.log
# Extract it to the user's HOME so that cosign can find the roots without network.
COPY verified-binaries/tuf-cache.tgz /tmp/tuf-cache.tgz
RUN tar -xzf /tmp/tuf-cache.tgz -C /home/ghst \
    && rm /tmp/tuf-cache.tgz \
    && chown -R ghst:ghst /home/ghst/.sigstore

# The image used to carry a copy of VEX Hub, downloaded from its main branch
# at build time, and serve it from 127.0.0.1:8080 in every container. Nothing
# pointed Trivy at it or passed --vex, so it was never read, and VEX data
# exists to suppress findings: an unverified copy of it is the last thing a
# scanner should keep switched on. If VEX is wanted, it belongs in scanx as a
# pinned `trivy vex repo` and an explicit --vex, not in the image.
RUN mkdir -p /opt/trivy-cache /workspace \
    && chown -R ghst:ghst /opt/trivy-cache /workspace

# Trivy databases are NOT baked into the image. They used to be, which cost
# ~2.8 GB of image size and forced a full re-pull whenever they went stale.
# They now live in a cache directory on the host, shared by every project and
# updated incrementally by `make sec/db/update`. The mount is supplied at run
# time by Makefile.scanners.
#
# Trivy still runs fully offline: it is told to skip every update check, so it
# uses whatever the mounted cache contains and never reaches the network
# itself.
ENV TRIVY_CACHE_DIR=/opt/trivy-cache \
    TRIVY_SKIP_DB_UPDATE=true \
    TRIVY_SKIP_JAVA_DB_UPDATE=true \
    TRIVY_SKIP_CHECK_UPDATE=true \
    TRIVY_OFFLINE_SCAN=true

# The misconfiguration checks, unlike the vulnerability databases, are a few MB
# of Rego that does belong in the image: CI downloads them next to the
# binaries, and TRIVY_SKIP_CHECK_UPDATE above means Trivy will not fetch them
# at run time. Without this copy `trivy config` logs an ERROR on every scan and
# silently falls back to whatever is compiled into the binary.
#
# The path is Trivy's own: it writes the bundle to <cache-dir>/policy, holding
# content/ and metadata.json. Only the vulnerability databases are mounted over
# at run time, so this survives.
COPY --chown=ghst:ghst verified-binaries/trivy-db/policy /opt/trivy-cache/policy

# Helper that applies incremental database updates, copied from CI alongside
# the other verified binaries.
COPY --chown=ghst:ghst verified-binaries/linux-${TARGETARCH}/trivy-db-helper /usr/local/bin/trivy-db-helper

# What this image is made of, as labels.
#
# CI resolves each of these versions and until now kept them to its own build
# log, which is unreachable from a developer's terminal and expires. A scan
# result that cannot be traced to the tools that produced it cannot be
# reproduced or disputed, so the versions travel with the image.
#
# The image also inherits labels from wolfi-base, including a vendor of
# "Chainguard". Ours are namespaced so they cannot be confused with those.
ARG TRIVY_VER
ARG TRUFFLEHOG_VER
ARG COSIGN_VER
ARG CRANE_VER
ARG HELPER_VER
LABEL fi.evolver.ghst.trivy.version="${TRIVY_VER}" \
      fi.evolver.ghst.trufflehog.version="${TRUFFLEHOG_VER}" \
      fi.evolver.ghst.cosign.version="${COSIGN_VER}" \
      fi.evolver.ghst.crane.version="${CRANE_VER}" \
      fi.evolver.ghst.trivy-db-helper.version="${HELPER_VER}"

# Non-root user
USER ghst

WORKDIR /workspace

CMD ["sh", "-lc", "echo 'Trivy:'; trivy --version; echo 'TruffleHog:'; trufflehog --version; echo 'Crane:'; crane version; echo 'Cosign:'; cosign version"]
