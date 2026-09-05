#!/usr/bin/env python3
"""Fail if a third-party action is unpinned, or pinned to a lie.

Two rules, and the second is the one experience argued for.

First: every third-party step inside actions/**/action.yml is pinned to a
commit SHA. These run on the consumer's runner -- someone using
security-scan@v1 executes them with that repository's token -- so a moved tag
is a change to code we ship without shipping anything. Workflow files here are
deliberately out of scope: they run only on this repository.

Second: the "# v1.2.3" after a SHA is resolved against the tag it names. That
comment is the only human-readable part of the pin and nothing has been
checking it, which is exactly how it drifts: an upgrade edits the comment,
someone reads the number, and the forty hex characters that actually decide
what runs still point at a release three majors back. It happened -- an
upload-artifact pinned at v4.6.2 wearing a "# v7.0.1" label, found by review
rather than by CI. A wrong comment is worse than no comment, because it is
believed.

Where a pin names a commit with no tag, the comment carries the commit's date
instead ("# Nov 11, 2025") and that is checked the same way.

Everything is asked over git rather than through the REST API, which is the
second version of this script. The first used api.github.com and failed in CI
on its eleventh request with GITHUB_TOKEN set, having already been impossible
to run locally: sixty anonymous requests an hour is about five runs, and
debugging a check costs more runs than that. git has no quota and needs no
token. It also answers more precisely -- refs/tags/X^{} is the commit an
annotated tag peels to, which is the number a pin must match, and the API
makes you ask for that in two steps and take the wrong one by default.

Anything it cannot resolve is an error, never a pass: a check that goes quiet
when the network is down would have reported success on every finding above.
"""
import atexit
import glob
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

USES = re.compile(r"^\s*(?:-\s*)?uses:\s*(\S+?)(?:\s+#\s*(.*?))?\s*$")
SHA = re.compile(r"^[0-9a-f]{40}$")
INTERNAL = "Avarko/gh-security-toolkit"
TAG_COMMENT = re.compile(r"^v?\d+(?:\.\d+)*$")
DATE_COMMENT = re.compile(r"^[A-Z][a-z]{2} \d{1,2}, \d{4}$")

_cache = {}
_scratch = None


class Unresolvable(Exception):
    """The lookup could not be made. Distinct from a pin being wrong."""


def git(*args, cwd=None):
    result = subprocess.run(
        ["git", *args], capture_output=True, text=True, timeout=120, cwd=cwd
    )
    if result.returncode != 0:
        raise Unresolvable(
            "git " + " ".join(args) + ": " + (result.stderr.strip() or "failed")
        )
    return result.stdout


def scratch_repo():
    """An empty repository to fetch single commits into."""
    global _scratch
    if _scratch is None:
        _scratch = tempfile.mkdtemp(prefix="pin-check-")
        atexit.register(shutil.rmtree, _scratch, True)
        git("init", "-q", "--bare", _scratch)
    return _scratch


def commit_for_tag(repo, tag):
    """The commit a tag points at, asked of the repository over git.

    An annotated tag names a tag object, not a commit, and a pin has to match
    the commit. git offers both and the difference is one suffix: refs/tags/X
    is whatever the tag names, refs/tags/X^{} is what it peels to. Reading the
    wrong one reports a correct pin as wrong, which cost an afternoon earlier
    in this work when the API's two-step version of the same question was
    answered halfway.
    """
    key = ("tag", repo, tag)
    if key not in _cache:
        out = git(
            "ls-remote", "--tags", f"https://github.com/{repo}", tag, tag + "^{}"
        )
        refs = {}
        for line in out.splitlines():
            sha, _, name = line.partition("\t")
            refs[name.strip()] = sha.strip()
        # Peeled first: for an annotated tag it is the commit, and for a
        # lightweight one it does not exist and the ref itself already is.
        _cache[key] = refs.get(f"refs/tags/{tag}^{{}}") or refs.get(f"refs/tags/{tag}")
    return _cache[key]


def commit_dates(repo, sha):
    """The dates a commit carries, fetched one commit deep.

    No ref names a date, so this is the one thing ls-remote cannot answer.
    A depth-1 fetch of the single commit costs about a second and a hundred
    kilobytes, which is cheaper than the API request it replaces was
    unreliable.
    """
    key = ("date", repo, sha)
    if key not in _cache:
        scratch = scratch_repo()
        try:
            git("fetch", "-q", "--depth=1", f"https://github.com/{repo}", sha,
                cwd=scratch)
        except Unresolvable:
            # A SHA the repository will not serve is a finding about the pin,
            # not a failure of the check: it is not a commit of that project.
            _cache[key] = None
            return None
        stamps = git("show", "-s", "--format=%cI%n%aI", sha, cwd=scratch).split()
        # Both the committer's own offset and UTC count as the commit's date.
        # A comment written from what GitHub displayed and one written from
        # `git log` can differ by a day either way, and neither is a mistake
        # worth failing a build over.
        dates = set()
        for stamp in stamps:
            moment = datetime.fromisoformat(stamp)
            dates.add(moment.date())  # as the committer's clock read it
            dates.add(moment.astimezone(timezone.utc).date())
        _cache[key] = dates
    return _cache[key]


def check_comment(repo, sha, comment):
    """Return a complaint about this pin's comment, or None if it holds up."""
    if not comment:
        return "no comment saying what this SHA is"

    if TAG_COMMENT.match(comment):
        actual = commit_for_tag(repo, comment)
        if actual is None:
            return f"comment says {comment}, which is not a tag of {repo}"
        if actual != sha:
            return f"comment says {comment}, which is {actual[:12]}"
        return None

    if DATE_COMMENT.match(comment):
        dates = commit_dates(repo, sha)
        if dates is None:
            return f"{sha[:12]} is not a commit of {repo}"
        claimed = datetime.strptime(comment, "%b %d, %Y").date()
        if claimed not in dates:
            # Built by hand rather than with strftime: "%-d" for an unpadded
            # day is a glibc extension and raises on Windows, and an error
            # message that crashes is worse than the error it reports.
            actual = sorted(dates)[0]
            return (
                f"comment says {comment}, commit is dated "
                f"{actual:%b} {actual.day}, {actual.year}"
            )
        return None

    # Not "v1.2.3" and not "Nov 11, 2025". Rejected rather than waved through:
    # a comment nothing can check is the state this script exists to end.
    return f"comment {comment!r} is neither a version tag nor a commit date"


def main():
    action_files = sorted(glob.glob("actions/**/action.yml", recursive=True))
    workflow_files = sorted(glob.glob(".github/workflows/*.yml"))

    unpinned, mislabelled = [], []
    checked = 0

    for path in action_files + workflow_files:
        in_action = path in action_files
        with open(path, encoding="utf-8") as handle:
            for number, line in enumerate(handle, 1):
                match = USES.match(line)
                if not match:
                    continue
                ref, comment = match.groups()
                if "@" not in ref or ref.startswith(("./", "docker://")):
                    continue
                target, _, version = ref.rpartition("@")
                if target.startswith(INTERNAL):
                    continue  # check-internal-action-refs.py owns these.

                if not SHA.match(version):
                    if in_action:
                        unpinned.append((path, number, ref))
                    continue

                repo = "/".join(target.split("/")[:2])
                checked += 1
                complaint = check_comment(repo, version, comment)
                if complaint:
                    mislabelled.append((path, number, target, complaint))

    if unpinned:
        print("Third-party actions inside composite actions must be SHA-pinned:\n")
        for path, number, ref in unpinned:
            print(f"  {path}:{number}: {ref}")
        print("\nThese execute on the consumer's runner, with their token.\n")

    if mislabelled:
        print("Pin comments that do not match what is pinned:\n")
        for path, number, target, complaint in mislabelled:
            print(f"  {path}:{number}: {target}: {complaint}")
        print("")

    if unpinned or mislabelled:
        print(f"{len(unpinned) + len(mislabelled)} finding(s).")
        return 1

    print(f"All {checked} SHA pin(s) match their comments.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Unresolvable as error:
        # Exit 2, and loudly. A pin check that passes when it could not reach
        # the network is a green tick that means nothing.
        print(f"Could not verify pins: {error}", file=sys.stderr)
        sys.exit(2)
