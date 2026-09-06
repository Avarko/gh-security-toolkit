#!/usr/bin/env bash
# Install the pinned JBang release and put it on PATH.
#
# This replaces jbangdev/setup-jbang, whose SHA pin was buying nothing. The
# action's whole Linux implementation was
#
#     curl -Ls https://sh.jbang.dev | bash -s - app setup
#
# so pinning its forty characters pinned the curl command and not what came
# back: an unpinned script, from a host that is not github.com, installing
# whichever version it decided on that morning. Three of the call sites are
# under actions/**, which means it ran on the consumer's runner holding the
# consumer's token -- the SECURITY.md F-6 case, arrived at through a
# dependency that looked pinned in review.
#
# Upstream had also stopped tagging: setup-jbang's newest tag is v0.1.1 from
# 2023, so Dependabot had no version to compare and every GitHub Actions
# advisory states its affected set as a version range. Nothing could have told
# us a CVE applied to the commit we were on. jbang itself releases properly,
# with a sha256 and a detached signature for every asset, so the pin moved
# down a layer onto the artifact that actually runs.
#
# Bumping: pick the version, fetch
#   .../releases/download/v$VERSION/jbang-$VERSION.zip.sha256
# and paste both below. The checksum is verified against the download on every
# run, so pasting the wrong one fails the build instead of installing
# something else.
set -euo pipefail

VERSION=0.141.0
SHA256=be34e7416227dac8b98c79e07d80488d73b3e131272a616e0754a7d496133fc0

# The plain distribution rather than jbang-$VERSION-linux-x64.zip, which
# bundles a JDK at three times the size and is published for x64 Linux only --
# that would drop consumers on macOS and arm runners. This one behaves as
# setup-jbang did: it uses the runner's Java, and lets jbang fetch a JDK when
# there is none.
ARCHIVE="jbang-${VERSION}.zip"
URL="https://github.com/jbangdev/jbang/releases/download/v${VERSION}/${ARCHIVE}"

root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/jbang-${VERSION}"
bin="${root}/jbang-${VERSION}/bin"

publish_path() {
    case ":${PATH}:" in
        *":${bin}:"*) ;;
        *) PATH="${bin}:${PATH}"; export PATH ;;
    esac
    if [ -n "${GITHUB_PATH:-}" ]; then
        if ! grep -qxF "${bin}" "${GITHUB_PATH}" 2>/dev/null; then
            echo "${bin}" >> "${GITHUB_PATH}"
        fi
    fi
}

# A workflow that uses both the summarizer and the publisher runs this twice in
# one job, so having it already there is a success and not a reason to
# re-download 13 MB.
if [ -x "${bin}/jbang" ]; then
    publish_path
    exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "⬇️  Installing jbang ${VERSION}"
# -f so a 404 or a proxy's error page is a failure here rather than a checksum
# mismatch two lines down, and set -e stops us before anything hashes it: the
# sha256 of nothing at all is a real, stable value, and comparing against it is
# how a failed download turns into a confusing verification error.
curl -fsSL --retry 3 --max-time 180 "${URL}" -o "${tmp}/${ARCHIVE}"

if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "${tmp}/${ARCHIVE}" | cut -d' ' -f1)"
else
    actual="$(shasum -a 256 "${tmp}/${ARCHIVE}" | cut -d' ' -f1)"
fi

if [ "${actual}" != "${SHA256}" ]; then
    echo "❌ ${ARCHIVE} does not match the pinned checksum." >&2
    echo "   expected ${SHA256}" >&2
    echo "   got      ${actual}" >&2
    exit 1
fi

mkdir -p "${root}"
unzip -q "${tmp}/${ARCHIVE}" -d "${root}"
chmod +x "${bin}/jbang"

publish_path
"${bin}/jbang" version
