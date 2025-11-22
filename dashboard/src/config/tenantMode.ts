// src/config/tenantMode.ts
/**
 * Build-time tenant mode configuration.
 *
 * Single-tenant: GitHub Pages deployment, data at /data/
 * Multi-tenant: Per-tenant backends (different S3 buckets, CDNs, etc.)
 *
 * Mode is determined at BUILD TIME via Vite environment variables.
 */

export type TenantMode = "single-tenant" | "multi-tenant";

/**
 * Multi-tenant configuration entry (admin-managed).
 *
 * SECURITY: Each tenant can have its own backend (data_base_url),
 * enabling complete data isolation between tenants.
 */
export type MultiTenantEntry = {
    id: string;              // UUID for data path identification
    url_path: string;        // Human-readable URL path (e.g., "acme-corp")
    display_name: string;    // UI display name

    /**
     * Base URL for this tenant's data.
     * Can be a different S3 bucket, CDN, or any HTTP backend per tenant.
     *
     * Examples:
     * - "https://acme-security-data.s3.amazonaws.com/data"
     * - "https://cdn.example.com/tenants/acme/data"
     * - "/data/acme-uuid" (same origin, different path)
     *
     * If not specified, defaults to "/data/<id>" (same origin).
     */
    data_base_url?: string;

    org_display_name?: string;
    logo_url?: string;
};

export type MultiTenantConfig = {
    tenants: MultiTenantEntry[];
};

// Build-time injected values (see vite.config.ts)
declare const __TENANT_MODE__: TenantMode;
declare const __MULTI_TENANT_CONFIG__: MultiTenantConfig | null;

/** Current tenant mode (build-time constant) */
export const TENANT_MODE: TenantMode = typeof __TENANT_MODE__ !== "undefined"
    ? __TENANT_MODE__
    : "single-tenant";

/** Multi-tenant configuration (only in multi-tenant mode) */
export const MULTI_TENANT_CONFIG: MultiTenantConfig | null =
    typeof __MULTI_TENANT_CONFIG__ !== "undefined"
        ? __MULTI_TENANT_CONFIG__
        : null;

export function isSingleTenant(): boolean {
    return TENANT_MODE === "single-tenant";
}

export function isMultiTenant(): boolean {
    return TENANT_MODE === "multi-tenant";
}

/**
 * Get data root URL/path for a tenant.
 *
 * Single-tenant: Returns "/data"
 * Multi-tenant: Returns tenant's data_base_url if specified,
 *               otherwise "/data/<tenantId>"
 *
 * @param tenant - The tenant entry (required in multi-tenant mode)
 */
export function getDataRootForTenant(tenant?: MultiTenantEntry): string {
    if (isSingleTenant()) {
        return "/data";
    }
    if (!tenant) {
        throw new Error("tenant required in multi-tenant mode");
    }

    // Use custom backend URL if specified, otherwise same-origin path
    if (tenant.data_base_url) {
        return tenant.data_base_url;
    }
    return `/data/${tenant.id}`;
}

/**
 * Get data root path (legacy compatibility).
 * @deprecated Use getDataRootForTenant(tenant) instead for full isolation support
 */
export function getDataRoot(tenantId?: string): string {
    if (isSingleTenant()) {
        return "/data";
    }
    if (!tenantId) {
        throw new Error("tenantId required in multi-tenant mode");
    }
    // Find tenant and use their data_base_url if available
    const tenant = MULTI_TENANT_CONFIG?.tenants.find(t => t.id === tenantId);
    if (tenant?.data_base_url) {
        return tenant.data_base_url;
    }
    return `/data/${tenantId}`;
}

/**
 * Find tenant by URL path (multi-tenant mode only).
 */
export function findTenantByUrlPath(urlPath: string): MultiTenantEntry | undefined {
    if (!MULTI_TENANT_CONFIG) return undefined;
    return MULTI_TENANT_CONFIG.tenants.find(t => t.url_path === urlPath);
}

/**
 * Get all tenants (multi-tenant mode only).
 */
export function getAllTenants(): MultiTenantEntry[] {
    return MULTI_TENANT_CONFIG?.tenants ?? [];
}
