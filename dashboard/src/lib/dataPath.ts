// src/lib/dataPath.ts
import { MissingTenantParamsError } from "../errors/MissingTenantParamsError";

type DataPathParams = {
    orgSlug?: string;
    appSlug?: string;
    repoSlug?: string;
};

/**
 * Generates the data path: /data/<org>/<app>/<repo>
 *
 * All three tenant slugs (org, app, repo) are required for both single-tenant
 * and multi-tenant deployments. This ensures consistent path structure.
 *
 * - Single-tenant: Fixed values (e.g., vr/fcciam/app-fc-ciam-backend)
 * - Multi-tenant: Variable per organization/app/repo
 */
export function getDataRoot(params: DataPathParams): string {
    const { orgSlug, appSlug, repoSlug } = params;

    if (!orgSlug || !appSlug || !repoSlug) {
        throw new MissingTenantParamsError(
            `All tenant slugs are required: orgSlug=${orgSlug}, appSlug=${appSlug}, repoSlug=${repoSlug}`
        );
    }

    return `/data/${orgSlug}/${appSlug}/${repoSlug}`;
}