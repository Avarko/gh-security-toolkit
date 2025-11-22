// src/routes/loaderHelpers.ts
/**
 * Helper functions for route loaders.
 */
import type { Params } from "react-router-dom";
import { isSingleTenant, findTenantByUrlPath, getDataRootForTenant } from "../config/tenantMode";

/**
 * Get data root URL from loader params.
 *
 * Single-tenant: returns "/data"
 * Multi-tenant: returns tenant's data_base_url if configured,
 *               otherwise "/data/<uuid>"
 *
 * SECURITY: In multi-tenant mode, each tenant can have a completely
 * different backend (e.g., separate S3 bucket) for data isolation.
 *
 * @throws Error if multi-tenant and tenant not found
 */
export function getDataRootFromParams(params: Params): string {
    if (isSingleTenant()) {
        return "/data";
    }

    const { tenantPath } = params;
    if (!tenantPath) {
        throw new Error("tenantPath parameter required in multi-tenant mode");
    }

    const tenant = findTenantByUrlPath(tenantPath);
    if (!tenant) {
        throw new Error(`Tenant not found: ${tenantPath}`);
    }

    return getDataRootForTenant(tenant);
}
