# CI provides build-args for tool versions to yield reproducible, non-flaky builds
ARG TRIVY_VER
ARG TRUFFLEHOG_VER
ARG COSIGN_VER
ARG CRANE_VER

FROM cgr.dev/chainguard/wolfi-base:latest

RUN apk update && apk add --no-cache \
    bash ca-certificates curl jq git python3 py3-pip \
    && update-ca-certificates

# Pre-verified binaries copied from CI
COPY verified-binaries/trivy /usr/local/bin/trivy
COPY verified-binaries/trufflehog /usr/local/bin/trufflehog
COPY verified-binaries/cosign /usr/local/bin/cosign
COPY verified-binaries/crane /usr/local/bin/crane

# Cosign TUF cache (for offline use)
# CI provides verified-binaries/tuf-cache.tgz containing .sigstore/ + cosign-init.log
# Extract it to the user's HOME so that cosign can find the roots without network.
# Note: The user is created first so that HOME exists.
RUN adduser -D -u 10001 ghst \
    && mkdir -p /home/ghst \
    && chown -R ghst:ghst /home/ghst

COPY verified-binaries/tuf-cache.tgz /tmp/tuf-cache.tgz
RUN tar -xzf /tmp/tuf-cache.tgz -C /home/ghst \
    && rm /tmp/tuf-cache.tgz \
    && chown -R ghst:ghst /home/ghst/.sigstore

# VEX Hub (internal)
ARG VEXHUB_MANIFEST_URL="https://raw.githubusercontent.com/aquasecurity/vexhub/main/vex-repository.json"
ARG VEXHUB_ARCHIVE_URL="https://github.com/aquasecurity/vexhub/archive/refs/heads/main.zip"

RUN mkdir -p /var/www/.well-known /var/www/vex /opt/trivy-cache /workspace \
    && chown -R ghst:ghst /var/www /opt/trivy-cache /workspace

# Download and extract VEX Hub data
RUN apk add --no-cache unzip \
    && curl -fsSL -o /tmp/vexhub.zip "${VEXHUB_ARCHIVE_URL}" \
    && unzip -q /tmp/vexhub.zip -d /tmp \
    && mv /tmp/vexhub-main /var/www/vex/vexhub \
    && rm /tmp/vexhub.zip \
    && curl -fsSL -o /var/www/.well-known/vex-repository.json "${VEXHUB_MANIFEST_URL}" \
    && sed -i 's#"url": *".*"#"url": "http://127.0.0.1:8080/vex/vexhub"#' /var/www/.well-known/vex-repository.json \
    && chown -R ghst:ghst /var/www \
    && apk del unzip

# Copy Trivy DBs for offline use
ENV TRIVY_CACHE_DIR=/opt/trivy-cache \
    TRIVY_SKIP_DB_UPDATE=true \
    TRIVY_OFFLINE_SCAN=true
COPY verified-binaries/trivy-db/ "${TRIVY_CACHE_DIR}/"

# Non-root user
USER ghst

# Lightweight HTTP server (BusyBox httpd) for VEX Hub serving
ENV GHST_VEX_SERVE=1 \
    GHST_VEX_PORT=8080

# Entrypoint script
COPY --chown=ghst:ghst <<'EOF' /usr/local/bin/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

if [ "${GHST_VEX_SERVE:-0}" = "1" ]; then
  # Use Python's built-in HTTP server (available in python3 package)
  cd /var/www && python3 -m http.server "${GHST_VEX_PORT}" &
  echo "VEX Hub served at http://127.0.0.1:${GHST_VEX_PORT}/.well-known/vex-repository.json"
fi

exec "$@"
EOF
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["sh", "-lc", "echo 'Trivy:'; trivy --version; echo 'TruffleHog:'; trufflehog --version; echo 'Crane:'; crane version; echo 'Cosign:'; cosign version"]
