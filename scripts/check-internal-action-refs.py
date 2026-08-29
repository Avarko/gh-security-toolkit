#!/usr/bin/env python3
"""Fail if the toolkit's references to its own actions are not all one pin.

A composite action that calls a sibling with @main ignores whatever ref the
consumer pinned: someone using security-scan@v1 still executes main's copy of
every action it delegates to. There is then no version boundary at all --
a commit reaches every consumer the moment it lands, unreviewed by them.

The release step is to move the tag these point at. Keeping them identical is
what makes that one step rather than ten.
"""
import glob
import re
import sys

EXPECTED_REF = "v1"
USES = re.compile(r"uses:\s*Avarko/gh-security-toolkit/(\S+)@(\S+)")


def main():
    paths = sorted(
        set(glob.glob("actions/**/action.yml", recursive=True))
        | set(glob.glob(".github/workflows/*.yml"))
    )

    findings = []
    seen = 0
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            for number, line in enumerate(handle, 1):
                match = USES.search(line)
                if not match:
                    continue
                seen += 1
                action, ref = match.groups()
                if ref != EXPECTED_REF:
                    findings.append((path, number, action, ref))

    if findings:
        print(f"Internal action references must all be @{EXPECTED_REF}:\n")
        for path, number, action, ref in findings:
            print(f"  {path}:{number}: {action}@{ref}")
        print(
            f"\n{len(findings)} finding(s). A consumer pinning a release still runs "
            f"whatever these point at.\nSee SECURITY.md, F-6."
        )
        return 1

    print(f"All {seen} internal action reference(s) pinned to @{EXPECTED_REF}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
