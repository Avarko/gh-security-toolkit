#!/usr/bin/env python3
"""Fail if a GitHub Actions expression appears inside a `run:` body.

A ${{ }} expression is substituted into the script text before bash parses it,
so a value carrying a quote closes its own assignment and the remainder runs as
script. Passing the value through `env:` and referencing "$VAR" keeps it data.

This check exists because the repository had 231 such interpolations, two of
which were exploitable: a branch name reaching `eval` in the TruffleHog
scanner, and the artifact-name validator executing the very input it was
called on to make safe.

Lines are matched, not parsed: a run: value in flow style ({run: ...}), under a
quoted key, or a plain scalar continued onto the next line is not seen.
"""
import glob
import re
import sys

RUN_START = re.compile(r"^\s*-?\s*run:\s*[|>]")
# A one-line `run: cmd ...` carries its script on the key's own line.
RUN_INLINE = re.compile(r"^\s*-?\s*run:\s*(?![|>])(\S.*)$")
EXPRESSION = re.compile(r"\$\{\{(.*?)\}\}")


def run_blocks(lines):
    """Yield (start, end) line indices of every block-scalar `run:` body."""
    i = 0
    while i < len(lines):
        if RUN_START.match(lines[i]):
            indent = len(lines[i]) - len(lines[i].lstrip())
            j = i + 1
            while j < len(lines):
                line = lines[j]
                if line.strip() and (len(line) - len(line.lstrip())) <= indent:
                    break
                j += 1
            yield i + 1, j
            i = j
        else:
            i += 1


def main():
    paths = sorted(
        set(glob.glob("actions/**/action.yml", recursive=True))
        | set(glob.glob(".github/workflows/*.yml"))
    )
    findings = set()
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().split("\n")
        for k, line in enumerate(lines):
            inline = RUN_INLINE.match(line)
            if inline:
                for expr in EXPRESSION.findall(inline.group(1)):
                    findings.add((path, k + 1, expr.strip()))
        for start, end in run_blocks(lines):
            for k in range(start, end):
                # Comments may name the syntax while explaining why it is banned.
                if lines[k].lstrip().startswith("#"):
                    continue
                for expr in EXPRESSION.findall(lines[k]):
                    findings.add((path, k + 1, expr.strip()))

    if findings:
        print("Expressions interpolated into run: bodies -- move them to env:\n")
        for path, line, expr in sorted(findings):
            print(f"  {path}:{line}: ${{{{ {expr} }}}}")
        print(f"\n{len(findings)} finding(s). See SECURITY.md, F-1 to F-3.")
        return 1

    print(f"No expressions inside run: bodies ({len(paths)} files checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
