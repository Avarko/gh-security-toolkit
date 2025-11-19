// src/lib/dataPath.ts
import { MissingTenantParamsError } from "../errors/MissingTenantParamsError";
import type { TenantRegistry } from "./tenantRegistry";
import { findTenantByGitHub, getTenantDataPath } from "./tenantRegistry";

type DataPathParams = {
    githubOrg: string;
    githubRepo: string;
    registry: TenantRegistry;
};

/**
 * Generates the data path: /data/<tenant-uuid>/
 *
 * GUID-based tenant system:
 * - GitHub org/repo identifies the tenant (case-insensitive)
 * - TenantRegistry maps org/repo to a UUID
 * - Data is stored at /data/<uuid>/ for security (prevents tenant forgery)
 *
 * @throws {MissingTenantParamsError} if org/repo not found in registry
 */
export function getDataRoot(params: DataPathParams): string {
    const { githubOrg, githubRepo, registry } = params;

    if (!githubOrg || !githubRepo) {
        throw new MissingTenantParamsError(
            `GitHub org and repo are required: org=${githubOrg}, repo=${githubRepo}`
        );
    }

    const tenant = findTenantByGitHub(registry, githubOrg, githubRepo);

    if (!tenant) {
        throw new MissingTenantParamsError(
            `Tenant not found in registry: ${githubOrg}/${githubRepo}`
        );
    }

    return getTenantDataPath(tenant.id);
}