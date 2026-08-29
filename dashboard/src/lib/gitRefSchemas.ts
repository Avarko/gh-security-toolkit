/**
 * Validation for the git identifiers that scan output carries.
 *
 * These are not display-only fields. Three components build
 * `https://github.com/${repository}/tree/${branch}` and put the result in an
 * href, so whatever passes validation here ends up in a URL. A branch of
 * "../../../evil/repo" resolves, once the browser normalises the path, to a
 * completely different repository than the one the link text names -- the link
 * reads "main" and goes somewhere else.
 *
 * The rules below are git's and GitHub's own, not invented restrictions:
 * git-check-ref-format rejects "..", "//", a leading or trailing "/", "@{" and
 * a ".lock" suffix in a ref name, and GitHub constrains owner and repository
 * names to a known character set. Anything a real scan produces passes.
 *
 * A rejected value becomes "" rather than failing its document. These schemas
 * validate a whole history file at once, so failing the document would let one
 * bad row blank the entire page -- the components already render nothing for
 * an empty branch or repository, which is the safe outcome: the link that
 * would have carried the value simply does not appear.
 */
import { z } from "zod";

const MAX_BRANCH_LENGTH = 200;
const MAX_COMMIT_SHA_LENGTH = 40;
const MAX_OWNER_LENGTH = 39;
const MAX_REPO_NAME_LENGTH = 100;

/** Rules from git-check-ref-format(1), limited to what a branch name can hit. */
function isWellFormedRef(branch: string): boolean {
    return (
        !branch.split("/").includes("..") &&
        !branch.includes("..") &&
        !branch.includes("//") &&
        !branch.startsWith("/") &&
        !branch.endsWith("/") &&
        !branch.startsWith(".") &&
        !branch.endsWith(".") &&
        !branch.includes("@{") &&
        !branch.endsWith(".lock")
    );
}

export const branchSchema = z
    .string()
    .min(1)
    .max(MAX_BRANCH_LENGTH)
    .regex(/^[a-zA-Z0-9/_\-.]+$/, "Invalid branch name")
    .refine(isWellFormedRef, "Invalid branch name")
    .optional()
    .default("")
    .catch("");

export const commitSchema = z
    .string()
    .max(MAX_COMMIT_SHA_LENGTH)
    .regex(/^[a-f0-9]{7,40}$/i, "Invalid git commit SHA")
    .optional()
    .default("")
    .catch("");

/**
 * "owner/repo", the only form the GitHub links are built for. Previously this
 * field had a length cap and nothing else, which left it the easier half of
 * the same URL to walk out of.
 */
export const repositorySchema = z
    .string()
    .regex(
        new RegExp(
            `^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,${MAX_OWNER_LENGTH - 1}}` +
                `/[a-zA-Z0-9._-]{1,${MAX_REPO_NAME_LENGTH}}$`,
        ),
        "Invalid repository (expected owner/repo)",
    )
    .refine(
        (value) => !value.split("/").some((part) => part === "." || part === ".."),
        "Invalid repository (expected owner/repo)",
    )
    .optional()
    .default("")
    .catch("");
