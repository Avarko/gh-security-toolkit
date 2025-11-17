// src/lib/dataPath.ts
import { MissingTenantParamsError } from "../errors/MissingTenantParamsError";

type DataPathParams = {
    orgSlug?: string;
    appSlug?: string;
    repoSlug?: string;
};

/**
 * Generates the data path prefix based on the provided parameters.
 * /data
 * /data/:org
 * /data/:org/:app
 * /data/:org/:app/:repo
 *
 * Multi-tenant-case: org + app (+ repo) always come from route parameters.
 * Single-tenant-case: they are practically always the same (defaults.json + redirect),
 * but the code does not change.
 */
export function getDataRoot(params: DataPathParams): string {
    const { orgSlug, appSlug, repoSlug } = params;

    if (!orgSlug || !appSlug) {
        throw new MissingTenantParamsError(
            `Invalid tenant path: orgSlug=${orgSlug}, appSlug=${appSlug}`
        );
    }

    if (repoSlug) {
        return `/data/${orgSlug}/${appSlug}/${repoSlug}`;
    }

    return `/data/${orgSlug}/${appSlug}`;
}