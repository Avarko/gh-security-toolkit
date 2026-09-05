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

Needs network and, on a runner, GITHUB_TOKEN -- the anonymous API allowance is
sixty an hour for the whole machine. Anything it cannot resolve is an error,
never a pass: a check that goes quiet when the network is down would have
reported success on every finding above.
"""
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime

USES = re.compile(r"^\s*(?:-\s*)?uses:\s*(\S+?)(?:\s+#\s*(.*?))?\s*$")
SHA = re.compile(r"^[0-9a-f]{40}$")
INTERNAL = "Avarko/gh-security-toolkit"
TAG_COMMENT = re.compile(r"^v?\d+(?:\.\d+)*$")
DATE_COMMENT = re.compile(r"^[A-Z][a-z]{2} \d{1,2}, \d{4}$")

API = "https://api.github.com"
_cache = {}


class Unresolvable(Exception):
    """The API could not answer. Distinct from a pin being wrong."""


def api(path):
    if path in _cache:
        return _cache[path]
    request = urllib.request.Request(
        API + path,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "gh-security-toolkit-pin-check",
            **(
                {"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"]}
                if os.environ.get("GITHUB_TOKEN")
                else {}
            ),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            _cache[path] = None
            return None
        if error.code in (403, 429):
            raise Unresolvable(
                f"{path}: HTTP {error.code}. The anonymous API allowance is "
                f"sixty requests an hour; set GITHUB_TOKEN."
            ) from error
        raise Unresolvable(f"{path}: HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise Unresolvable(f"{path}: {error}") from error
    _cache[path] = body
    return body


def commit_for_tag(repo, tag):
    """The commit a tag points at, following annotated tags to their target.

    git/ref/tags/<tag> returns the tag *object* for an annotated tag, whose SHA
    is not the commit's. Comparing that one reports a correct pin as wrong,
    which is how the first version of this check spent an afternoon.
    """
    ref = api(f"/repos/{repo}/git/ref/tags/{tag}")
    if ref is None:
        return None
    obj = ref["object"]
    if obj["type"] == "commit":
        return obj["sha"]
    if obj["type"] == "tag":
        return api(f"/repos/{repo}/git/tags/{obj['sha']}")["object"]["sha"]
    raise Unresolvable(f"{repo}@{tag}: tag points at a {obj['type']}")


def commit_dates(repo, sha):
    commit = api(f"/repos/{repo}/commits/{sha}")
    if commit is None:
        return None
    stamps = commit["commit"]
    return {
        datetime.fromisoformat(stamps[which]["date"].replace("Z", "+00:00")).date()
        for which in ("author", "committer")
    }


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
            return (
                f"comment says {comment}, commit is dated "
                f"{sorted(dates)[0].strftime('%b %-d, %Y')}"
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
        # the API is a green tick that means nothing.
        print(f"Could not verify pins: {error}", file=sys.stderr)
        sys.exit(2)
