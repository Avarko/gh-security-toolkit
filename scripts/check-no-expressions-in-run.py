#!/usr/bin/env python3
"""Fail if a GitHub Actions expression appears inside a `run:` body.

A ${{ }} expression is substituted into the script text before bash parses it,
so a value carrying a quote closes its own assignment and the remainder runs as
script. Passing the value through `env:` and referencing "$VAR" keeps it data.

This check exists because the repository had 231 such interpolations, two of
which were exploitable: a branch name reaching `eval` in the TruffleHog
scanner, and the artifact-name validator executing the very input it was
called on to make safe.
"""
import glob
import re
import sys

RUN_START = re.compile(r"^\s*-?\s*run:\s*[|>]")
EXPRESSION = re.compile(r"\$\{\{([^}]*)\}\}")


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
    findings = []
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().split("\n")
        for start, end in run_blocks(lines):
            for k in range(start, end):
                # Comments may name the syntax while explaining why it is banned.
                if lines[k].lstrip().startswith("#"):
                    continue
                for expr in EXPRESSION.findall(lines[k]):
                    findings.append((path, k + 1, expr.strip()))

    if findings:
        print("Expressions interpolated into run: bodies -- move them to env:\n")
        for path, line, expr in findings:
            print(f"  {path}:{line}: ${{{{ {expr} }}}}")
        print(f"\n{len(findings)} finding(s). See SECURITY.md, F-1 to F-3.")
        return 1

    print(f"No expressions inside run: bodies ({len(paths)} files checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
