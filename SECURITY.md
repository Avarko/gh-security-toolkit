# Security

How this toolkit is built to be trustworthy, where its trust boundaries are, and
what is currently known to be wrong with it.

The toolkit reports on other people's security, so the standard it is held to
here is higher than for an ordinary library: a scanner that can be made to lie,
or that can be turned against the repository running it, is worse than no
scanner, because it is believed.

## Reporting a vulnerability

Report privately to the maintainers rather than opening a public issue. Include
the affected component (action, workflow, image, dashboard or database
pipeline), what an attacker controls, and what they gain.

---

## 1. What this is, and who can attack it

The toolkit has four parts, and they have different attackers:

| Component | Runs where | Attacker of interest |
|---|---|---|
| Composite actions (`actions/**`) | The consumer's GitHub Actions runner, with the consumer's `GITHUB_TOKEN` | Anyone who can influence a value the consumer wires into an action input -- on a public repository, anyone who can open a pull request |
| Scanner image (`ghcr.io/avarko/gh-security-toolkit`) | The consumer's runner and developer machines | Anyone who can push to the registry, or upstream of a bundled binary |
| Vulnerability databases (`ghcr.io/avarko/trivy-incremental-dbs`) | Pulled by every scan | Anyone who can push to that registry |
| Dashboard (`dashboard/`) | A static site read by humans | Anyone who can write scan output into the published data root |

Two consequences shape everything below.

**The actions are a library, so they cannot assume a careful caller.** A
consumer decides what to pass as `channel`, `head` or `artifact_name`. Some of
those values will come from event data, because that is the obvious way to wire
a CI integration. An action that is only safe when its caller is careful is not
safe.

**The vulnerability database decides every verdict.** A doctored database does
not produce a wrong-looking answer. It produces a clean one.

---

## 2. Trust boundaries

```
 developer machine / CI runner
   |
   |  (1) make include: HTTPS fetch of Makefile.scanners, pinned by GHST_REF
   v
 Makefile.scanners
   |
   |  (2) docker pull ghcr.io/avarko/gh-security-toolkit:main
   |      -- image contents cosign/SLSA-verified at BUILD time
   v
 scanner container  (non-root uid 10001, --network=none)
   |
   |  (3) trivy-db-helper: crane pull of the vulnerability database
   |      -- cosign-verified against the publishing workflow identity
   v
 scan results
   |
   |  (4) published to GitHub Pages / S3 as static JSON
   v
 dashboard (static SPA, validates what it reads with Zod)
```

Boundaries (2) and (3) authenticate the publisher. Boundary (1) does not: it is
trust-on-first-use over HTTPS, pinned by ref, and there is no anchor available
before the toolkit is bootstrapped (F-5). Boundary (4) is defended in the
client, and a client is not where isolation can be enforced -- per-tenant
hosting is (F-7).

---

## 3. What the design gets right

These are deliberate and worth preserving.

**Scans do not touch the network.** Every scan target runs with
`--network=none`. Only `sec/db/update` reaches out, and only for database
updates. A scanned repository cannot exfiltrate through the scanner.

**The image build verifies everything it bundles.** Binaries are downloaded in
CI and checked before they are copied in: cosign signature verification for
cosign itself and Trivy, `slsa-verifier verify-artifact` for crane. The image
is published with SLSA3 provenance and an attested SBOM. Tool versions come
from build args so a build is reproducible rather than "whatever was latest".

**The container is not root.** `USER ghst` (uid 10001), Wolfi base, and the
databases are mounted read-only with a tmpfs for Trivy's scratch state, so a
scan cannot corrupt the cache it reads.

**The database is signed, and verified before it is used.** Publishing signs
each artifact and the manifest with cosign keyless; the client verifies against
the publishing workflow's identity, by digest, before unpacking. Verification
runs during an update, the one moment a client is online by design.

**Stale data fails rather than passes.** `__GHST_DB_MAX_AGE_DAYS` refuses to
scan against a database older than 14 days, on the reasoning that stale
vulnerability data reports "clean" for everything published since. The image
has the same freshness check.

**Third-party actions carrying real risk are SHA-pinned.**
`jbangdev/setup-jbang`, `aquasecurity/trivy-action` and
`yogeshlonkar/trivy-cache-action` are pinned to commit SHAs with a dated
comment.

**The safe input idiom exists and is used at the entry point.**
`actions/security-scan/action.yml` passes every value through `env:` and its
scripts read them as environment variables -- `validate-channel.sh` is the
model. No expression is interpolated into a shell script there.

**The dashboard validates what it renders.** Scan history is parsed with Zod
schemas rather than trusted, and a tenant's data root is resolved through a
registry lookup (`findTenantByUrlPath`), not by interpolating the URL segment
into a path.

---

## 4. Findings

From an audit on 2026-08-29 covering the actions, workflows, shell scripts,
Makefile, image, database pipeline and dashboard.

All nine are fixed, except the part of F-8 that only a rebuild can fix. Each
entry keeps its original description, because what was wrong is the useful
part to remember, and records what was done.

### F-1 (critical) -- Expression injection into `eval` in the TruffleHog scanner

`actions/scanner/trufflehog/action.yml` interpolates `inputs.base`,
`inputs.head` and `inputs.extra_args` into the shell script text, concatenates
them into `CMD`, and runs `eval "$CMD"`.

Two stages compound. GitHub substitutes `${{ inputs.head }}` into the script
before bash parses it, so a value containing a quote escapes the assignment;
and whatever survives into `CMD` is then re-parsed by `eval`.

The action's own input description invites the dangerous value: *"Base
commit/branch to scan from (e.g., 'main' or commit SHA)"*, and the README shows
`base: origin/main` / `head: origin/develop`. A consumer scanning pull requests
will reasonably pass `head: ${{ github.head_ref }}` -- and on a fork pull
request the branch name is chosen by the attacker. Git permits characters that
are shell metacharacters.

Result: arbitrary command execution on the consumer's runner with the
consumer's `GITHUB_TOKEN`.

**Fixed.** The values pass through `env:`. The command is an array executed
directly, and `extra_args` is split with `read -a`, so its words can only ever
be arguments. Verified with `main; touch FILE`, `$(touch FILE)` and a backtick
form: all three arrive as inert argument text.

### F-2 (high) -- The input-validation action is itself an injection point

`actions/validation/artifact-name/action.yml` opens with:

```bash
ARTIFACT_NAME="${{ inputs.artifact_name }}"
```

and then checks length and character set. The check cannot help: substitution
happens before bash parses the line, so an input of `"; <command>; echo "` runs
`<command>` at assignment time. Verified by reproducing the generated script --
the injected command executes and *then* validation reports "invalid
characters" and exits 1, having already run it.

This one matters beyond its own blast radius, because it is the action a
consumer reaches for when they want an untrusted name made safe.

**Fixed.** The value arrives in `env:` and the checks run against
`"$ARTIFACT_NAME"`, the shape `validate-channel.sh` already used.

### F-3 (high) -- The same unsafe idiom across fifty-three call sites

`VAR="${{ inputs.x }}"` inside `run:` appears throughout
`actions/cleanup/github-release`, `actions/notify/slack`,
`actions/scanner/semgrep`, `actions/scanner/trufflehog`,
`actions/scanner/dependabot`, `actions/summarizer`,
`actions/publisher/github-release` and the `manage-artifacts` and
`publish-dashboard` workflows.

Fifty-three assignments of this shape: 31 take a consumer-supplied `inputs.*`
value directly, 13 take a `steps.*.outputs.*` value that in several cases
derives from one. Severity varies with how plausible an untrusted value is for
each input, but the fix is uniform and mechanical, and the codebase already
contains the pattern to copy.

**Fixed.** Zero expressions remain in any `run:` body.
`scripts/check-no-expressions-in-run.py` holds the line and runs in CI. Where a
built-in variable already carried the value -- `GITHUB_ACTION_PATH`,
`GITHUB_REPOSITORY`, `RUNNER_TEMP` -- that is used instead of a new one.

Seven needed more than a substitution, because a single-quoted expression
cannot become `"$VAR"`: two jq filters that had the channel name in the program
text now pass `--arg`, and three `echo '<expression>'` writes of JSON became
`printf '%s'` of an environment value.

### F-4 (high) -- The vulnerability database is not signature-verified

`trivy-db-helper` resolves `ghcr.io/avarko/trivy-incremental-dbs:<tag>` to a
manifest and pulls the layer by digest. Content addressing gives integrity
relative to that manifest, but nothing establishes that the manifest came from
the legitimate publisher, and the `Checksum` recorded at publish time is never
checked on the client.

Anyone who can push to that registry can replace the database every scan
downstream relies on, and the failure is silent: scans report clean.

This is the sharpest asymmetry in the design -- the image goes to considerable
lengths to verify the binaries it bundles, using cosign, which it also ships,
while the data that determines every result is taken on trust.

**Fixed** in `trivy-incremental-dbs`. Artifacts and the manifest are signed
with cosign's keyless flow, so the signature carries the publishing workflow's
identity and there is no key to protect. The client verifies before unpacking,
against the manifest digest rather than the tag it was reached through, since a
tag can move between the two calls.

Enforced unless `GHST_DB_REQUIRE_SIGNATURE` is exactly `0` -- a typo in that
variable enforces rather than disables. **Sequencing matters:** artifacts
published before this carry no signature, so sign the current base and deltas
before rolling the verifying client out.

### F-5 (medium) -- Bootstrap fetches and executes make code with no verification

The consumer-side `Makefile` includes:

```make
[ -f $$__GHST_FILE ] || curl -fsSL ".../main/Makefile.scanners" -o $$__GHST_FILE
```

Fetched over HTTPS from a mutable branch, with no signature or checksum, and
executed as make code on the developer's machine. It is also cached
permanently: the `[ -f ]` guard means the copy is never refreshed, so a
developer keeps running whatever was fetched the first time. That has already
caused a concrete problem -- a stale vendored copy predating the current
scanner targets -- and it means a security fix to `Makefile.scanners` does not
reach existing checkouts at all.

**Fixed.** `GHST_REF` pins what is fetched and `.gh-security-toolkit/REF`
records it, so changing the pin refreshes the copy instead of leaving a
first-fetch artifact in place forever.

This remains trust-on-first-use over HTTPS. Verifying a signature over this
file needs a trust anchor the consumer holds before the toolkit is
bootstrapped, and the only one available is the checkout itself; the comment in
the Makefile says so rather than implying more.

### F-6 (medium) -- Internal action references float on `@main`

Ten `uses:` references point at `Avarko/gh-security-toolkit/...@main`, as does
the documented consumer usage. There is no version boundary between a commit
landing on main and every consumer executing it, so a mistake or a compromise
propagates immediately and unreviewably. `anchore/sbom-action@v0` floats on a
major version for the same reason.

**Fixed.** Internal references are pinned to `@v1`, and
`scripts/check-internal-action-refs.py` keeps them identical so that moving the
tag is one step rather than ten. See §6 for what a release now involves.

### F-7 (medium) -- Dashboard route parameters are interpolated into fetch paths

`ChannelScanRunDetailRoute` builds `${dataRoot}/runs/${channel}/${timestamp}`
from URL parameters without validating them, although `channelSchema` exists
and is applied to the same field elsewhere. Percent-encoded traversal in the
URL redirects the fetch within the origin. In multi-tenant deployments that
share an origin this reaches across the tenant separation the route structure
implies.

The wider point: the dashboard is a static SPA, so tenant isolation cannot be
enforced in it. Anything served from one origin is readable by anyone who can
read that origin, whatever the routes suggest. Isolation has to come from the
hosting layer -- separate buckets or sites per tenant, which
`getDataRootForTenant` already supports.

**Fixed.** Both schemas moved to `dashboard/src/lib/scanIdentifiers.ts` --
each model file had carried a copy -- and the route validates the pair before
building the path.

The wider point stands and is not something code here can fix: tenant isolation
has to come from the hosting layer, separate buckets or sites per tenant, which
`getDataRootForTenant` already supports.

### F-8 (medium) -- Scanner image is behind on patches

Scanned with itself on 2026-08-29 (`make sec/scan/trivy/img`, Trivy 0.74.0):
**0 critical, 31 high, 4 medium**, against an image built 2026-08-18.

| Component | Highs | Cause |
|---|---|---|
| `cosign` | 13 | Go stdlib, `golang.org/x/mod`, `x/text`, `grpc` |
| `crane` | 8 | Go stdlib (built with Go 1.26.5) |
| `trivy-db-helper` | 7 | Go stdlib (built with Go 1.25.12) |
| Wolfi base | 3 | `busybox`, `libcrypto3`, `libssl3` |

Every one has a fixed version available. The Go stdlib CVEs dominate and share
one remedy: rebuild with Go 1.26.6 or 1.25.13. The base packages are fixed by
rebuilding on current Wolfi.

None is remotely reachable in the way the toolkit uses these tools -- scans run
with `--network=none` -- but a security image carrying 31 unpatched highs is
not defensible to the people being asked to act on its output.

**Open, and only a rebuild closes it.** The versions come from CI build args
and upstream releases, so there is nothing in the repository to change:
`.mise.toml` already floats the helper's Go on `1.25`, which now resolves past
the fixed patch. The `trivy-db-helper` in the image also predates
`helper-v1.0.5`, so the rebuild is due on functional grounds too.

What is fixed is that this stops depending on someone noticing: `self-checks`
scans the published image weekly with Trivy directly -- not through the toolkit
image, so a vulnerability there cannot suppress its own report -- and fails on
a fixable high.

### F-9 (low) -- A comment contradicts the code it documents

`sec/scan/trivy/img` prints "network isolation disabled for this scan" while
the command it runs passes `--network=none`. The scan is isolated; the message
says otherwise. Docker socket access is genuinely required for this target, and
that is worth saying plainly -- the socket is root-equivalent on the host, and
this is the one command that mounts it.

**Fixed.** The message now says what is true: this is the one target that
mounts the Docker socket, that is root-equivalent access to the host, and the
scan itself still runs with `--network=none`.

---

## 5. Checks that hold this in place

Running in `self-checks.yml`, because every finding above was invisible while
it existed -- an action that interpolates an input works perfectly for every
value except the one that matters.

| Check | Guards |
|---|---|
| `scripts/check-no-expressions-in-run.py` | F-1, F-2, F-3 -- zero expressions in any `run:` body |
| `scripts/check-internal-action-refs.py` | F-6 -- internal references all on one pin |
| Workflow and action YAML parse | A malformed action fails at use, in a consumer's pipeline |
| Dashboard typecheck and tests | F-7 and the schema work it rests on |
| `npm audit --omit=dev --audit-level=high` | Dependencies of the code that renders other people's scan results |
| Weekly scan of the published image | F-8 -- staleness surfaces on a schedule, not when noticed |

## 6. Releasing

Internal action references are pinned to `@v1`, so a consumer pinning a release
gets that release all the way down. The cost is that `main` is not what
consumers run: publishing means moving the tag.

```
git tag -f v1 <commit> && git push -f origin v1
```

`scripts/check-internal-action-refs.py` fails if the references drift apart, so
this stays one step.

## 7. Standing expectations

- The image is rebuilt on a schedule, not when someone notices. Its own scan is
  part of the release, and 31 highs should have failed something.
- New shell in an action takes its values from `env:`. No expression belongs
  inside a `run:` body.
- Anything fetched at run time is verified against a publisher, not merely
  transported over TLS.
- Tenant isolation is a hosting decision. The dashboard can present a boundary;
  it cannot enforce one.
