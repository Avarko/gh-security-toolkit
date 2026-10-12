#!/usr/bin/env python3
"""Report pinned tools that have a newer upstream release.

The scanner image and the local scans pin every third-party tool to an exact
version, because resolving releases/latest put whatever was newest on the day
of a build into the image with nobody looking at it. The cost of pinning is
that nothing moves on its own: a pin goes stale exactly as quietly as latest
used to change. This script is the other half -- it names each pin, asks
upstream for its newest stable release, and says which ones are behind.

Being behind is reported, not failed. A newer release is a question for a
person ("Pinned components" in AGENTS.md says what to check before bumping),
and newer is not automatically better here: crane v0.22.0 shipped built with
an older Go than v0.21.9. One thing does fail: the self-check's scanner must
be the same Trivy the image ships, because an older one misreads the newer
binary's version string and reports skipped checks as clean.

Asked over git, like check-action-pins.py, so it needs no token and has no
quota.
"""

from __future__ import annotations  # str | None on the python3 macOS ships (3.9)

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / ".github/workflows/int-manual-build-scanner-cli.yml"
SELF_CHECKS = ROOT / ".github/workflows/self-checks.yml"
MAKEFILE = ROOT / "Makefile.scanners"

# Pin variable in the build workflow -> upstream repository.
BUILD_PINS = {
    "trivy": "aquasecurity/trivy",
    "cosign": "sigstore/cosign",
    "crane": "google/go-containerregistry",
    "trufflehog": "trufflesecurity/trufflehog",
}

STABLE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")


def newest_release(repo: str) -> str | None:
    out = subprocess.run(
        ["git", "ls-remote", "--tags", "--refs", f"https://github.com/{repo}.git"],
        capture_output=True, text=True, timeout=60,
    )
    if out.returncode != 0:
        return None
    best = None
    for line in out.stdout.splitlines():
        tag = line.rsplit("refs/tags/", 1)[-1]
        m = STABLE.match(tag)
        if m and (best is None or tuple(map(int, m.groups())) > best[0]):
            best = (tuple(map(int, m.groups())), tag)
    return best[1] if best else None


def pinned(text: str, pattern: str, what: str) -> str:
    m = re.search(pattern, text, re.MULTILINE)
    if not m:
        sys.exit(f"cannot find the {what} pin")
    return m.group(1)


def main() -> int:
    build = BUILD.read_text()
    pins = []
    for name, repo in BUILD_PINS.items():
        pins.append((name, repo, pinned(build, rf"^\s*ver_{name}=(v[\d.]+)\s*$", name),
                     BUILD.relative_to(ROOT)))
    pins.append(("semgrep", "semgrep/semgrep",
                 "v" + pinned(MAKEFILE.read_text(), r"^SEMGREP_VERSION \?= ([\d.]+)", "semgrep"),
                 MAKEFILE.relative_to(ROOT)))

    failed = False
    scanner = pinned(SELF_CHECKS.read_text(), r"^\s*version: (v[\d.]+)", "self-check Trivy")
    image_trivy = pins[0][2]
    if scanner != image_trivy:
        print(f"FAIL self-check scans with Trivy {scanner} but the image ships {image_trivy}; "
              f"move {SELF_CHECKS.relative_to(ROOT)} with the image")
        failed = True

    behind = 0
    for name, repo, have, where in pins:
        newest = newest_release(repo)
        if newest is None:
            print(f"?    {name:<11} {have:<10} could not ask {repo}")
        elif newest.lstrip("v") != have.lstrip("v"):
            behind += 1
            print(f"NEW  {name:<11} {have:<10} -> {newest:<10} ({where})")
        else:
            print(f"ok   {name:<11} {have}")

    if behind:
        print(f"\n{behind} pin(s) behind upstream. See 'Pinned components' in AGENTS.md "
              "before bumping; this is a question for a person, not a failure.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
