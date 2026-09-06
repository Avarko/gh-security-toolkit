#!/usr/bin/env python3
"""Fail if the three copies of the Semgrep configuration disagree.

Semgrep is configured in three places that cannot share a variable. The
Makefile is fetched on its own by curl and never sees the repository;
actions/scanner/semgrep declares its default in YAML; and the client config
reader has a third copy in shell. Nothing was keeping them in step, and they
had already drifted: the Makefile ran eight rulesets, the other two ran six,
so a developer's local scan and the same commit's CI scan checked different
rules and neither said so.

The Semgrep version drifted the same way and more quietly. CI installed
whatever "pip3 install semgrep" resolved to that minute while the Makefile ran
whatever "semgrep/semgrep:latest" Docker had first cached, so the two were
different builds by construction rather than by accident.

There is no fourth place that is the truth: this compares the three against
each other and reports what differs, which is all a build needs to refuse.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

MAKEFILE = ROOT / "Makefile.scanners"
ACTION = ROOT / "actions" / "scanner" / "semgrep" / "action.yml"
CLIENT = ROOT / "actions" / "security-scan" / "scripts" / "read-client-config.sh"


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        sys.exit(f"cannot read {path.relative_to(ROOT)}: {exc}")


def find(path, pattern, what):
    """The one capture in this file, or an error naming what was looked for."""
    matches = re.findall(pattern, read(path), re.MULTILINE)
    if len(matches) != 1:
        sys.exit(
            f"{path.relative_to(ROOT)}: expected exactly one {what}, found "
            f"{len(matches)}. The check cannot verify what it cannot locate."
        )
    return matches[0]


def rulesets(raw):
    """Normalise to a set, since the three spell the separator differently."""
    return frozenset(part for part in re.split(r"[,\s]+", raw.strip()) if part)


def main():
    configs = {
        "Makefile.scanners": rulesets(
            find(MAKEFILE, r"^SEMGREP_CONFIGS \?= (.+)$", "SEMGREP_CONFIGS assignment")
        ),
        "actions/scanner/semgrep/action.yml": rulesets(
            find(ACTION, r'^    default: "(p/.+)"$', "semgrep_configs default")
        ),
        "read-client-config.sh": rulesets(
            find(CLIENT, r'^SEMGREP_CONFIGS="(p/.+)"$', "SEMGREP_CONFIGS assignment")
        ),
    }

    versions = {
        "Makefile.scanners": find(
            MAKEFILE, r"^SEMGREP_VERSION \?= (\S+)$", "SEMGREP_VERSION assignment"
        ),
        "actions/scanner/semgrep/action.yml": find(
            ACTION, r"semgrep==(\S+)$", "pinned pip install"
        ),
    }

    problems = []

    if len(set(configs.values())) != 1:
        problems.append("The Semgrep rulesets differ:")
        agreed = frozenset.intersection(*configs.values())
        for where, value in configs.items():
            extra = sorted(value - agreed)
            problems.append(f"  {where}: {len(value)} ruleset(s)")
            if extra:
                problems.append(f"    only here: {', '.join(extra)}")

    if len(set(versions.values())) != 1:
        problems.append("The pinned Semgrep versions differ:")
        for where, value in versions.items():
            problems.append(f"  {where}: {value}")

    if problems:
        print("\n".join(problems), file=sys.stderr)
        print(
            "\nA local scan and a CI scan have to run the same Semgrep over the\n"
            "same rules, or a finding that appears in one and not the other\n"
            "looks like a change in the code.",
            file=sys.stderr,
        )
        return 1

    count = len(next(iter(configs.values())))
    print(
        f"Semgrep {versions['Makefile.scanners']} and {count} ruleset(s), "
        "agreed across all 3 declarations."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
