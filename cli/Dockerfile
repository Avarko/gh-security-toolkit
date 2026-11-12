# The operating system layer is built by apko from cli/apko.yaml, with every
# package version fixed by cli/apko.lock.json, and passed in by digest. It has
# no package manager and no utilities, only a bare /bin/sh for git, so this
# file only adds files: no RUN.
#
# apko builds the same bytes from the same lockfile, so the base digest moves
# only when a package does, and an unchanged toolkit rebuilds to an unchanged
# image instead of a fresh download for everybody.
#
# Locally: `make image/base` loads the base as ghst-base:local-<arch>, and
#   docker build --build-arg BASE=ghst-base:local-amd64 cli
# builds this on it, given a verified-binaries/ directory as CI lays it out.
ARG BASE
FROM ${BASE}

ARG TARGETARCH

# Pre-verified binaries copied from CI, owned by root: the image runs as ghst,
# which has no business replacing them.
COPY verified-binaries/linux-${TARGETARCH}/trivy           /usr/local/bin/trivy
COPY verified-binaries/linux-${TARGETARCH}/trufflehog      /usr/local/bin/trufflehog
COPY verified-binaries/linux-${TARGETARCH}/cosign          /usr/local/bin/cosign
COPY verified-binaries/linux-${TARGETARCH}/crane           /usr/local/bin/crane
COPY verified-binaries/linux-${TARGETARCH}/trivy-db-helper /usr/local/bin/trivy-db-helper

# Semgrep: its Python packages, installed by CI from PyPI wheels whose hashes
# cli/semgrep/requirements.txt fixes, and its two commands. `semgrep` runs
# `pysemgrep` through PATH for most subcommands, so both go on it. The site
# directory is root-owned like the binaries; Python therefore cannot cache
# bytecode there, and PYTHONDONTWRITEBYTECODE stops it from trying.
COPY verified-binaries/linux-${TARGETARCH}/semgrep-site    /opt/semgrep
COPY verified-binaries/linux-${TARGETARCH}/semgrep         /usr/local/bin/semgrep
COPY verified-binaries/linux-${TARGETARCH}/pysemgrep       /usr/local/bin/pysemgrep
ENV PYTHONPATH=/opt/semgrep \
    PYTHONDONTWRITEBYTECODE=1

# Cosign's TUF cache, for verifying database signatures without a network.
# CI creates verified-binaries/tuf-cache.tgz (.sigstore/ and cosign-init.log);
# ADD unpacks a local archive itself, so the build needs no RUN step for it.
# (The base does have a bare /bin/sh, for git; the build just never uses it.)
ADD --chown=10001:10001 verified-binaries/tuf-cache.tgz /home/ghst/

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
COPY --chown=10001:10001 verified-binaries/trivy-db/policy /opt/trivy-cache/policy

# What this image is made of, as labels.
#
# CI resolves each of these versions and until now kept them to its own build
# log, which is unreachable from a developer's terminal and expires. A scan
# result that cannot be traced to the tools that produced it cannot be
# reproduced or disputed, so the versions travel with the image.
ARG TRIVY_VER
ARG TRUFFLEHOG_VER
ARG COSIGN_VER
ARG CRANE_VER
ARG HELPER_VER
ARG SEMGREP_VER
LABEL fi.evolver.ghst.trivy.version="${TRIVY_VER}" \
      fi.evolver.ghst.trufflehog.version="${TRUFFLEHOG_VER}" \
      fi.evolver.ghst.cosign.version="${COSIGN_VER}" \
      fi.evolver.ghst.crane.version="${CRANE_VER}" \
      fi.evolver.ghst.trivy-db-helper.version="${HELPER_VER}" \
      fi.evolver.ghst.semgrep.version="${SEMGREP_VER}"

# The base already runs as ghst (uid 10001) in /workspace; stated again so
# nobody has to open apko.yaml to find out.
USER 10001
WORKDIR /workspace

# No shell to print versions with, so the default is one tool's version; the
# labels above list them all.
CMD ["trivy", "--version"]
