// src/config/tenantMode.ts
/**
 * Build-time tenant mode configuration.
 *
 * This module provides compile-time constants for tenant mode,
 * injected by Vite during the build process.
 *
 * SECURITY & ARCHITECTURE:
 * - Tenant mode is determined at BUILD TIME, not runtime
 * - Single-tenant mode: GitHub Pages deployment (always one tenant)
 * - Multi-tenant mode: S3/CDN deployment with admin-managed tenant config
 *
 * The mode cannot change at runtime, ensuring predictable behavior
 * and preventing configuration attacks.
 */

/**
 * Tenant modes supported by the application.
 *
 * - single-tenant: GitHub Pages deployment, data at /data/, no tenant routing
 * - multi-tenant: S3 deployment, data at /data/<uuid>/, tenant-aware routing
 */
export type TenantMode = "single-tenant" | "multi-tenant";

/**
 * Multi-tenant configuration entry.
 * Only used when TENANT_MODE === "multi-tenant".
 *
 * Admin-managed fields:
 * - id: GUID for data path (/data/<id>/)
 * - url_path: Human-readable URL path (admin-chosen, e.g., "fr-ciam")
 * - display_name: UI display name
 */
export type MultiTenantEntry = {
    id: string;              // GUID - used for data path
    github_org: string;      // For CI/CD identification
    github_repo: string;     // For CI/CD identification
    url_path: string;        // Admin-chosen, human-readable URL path
    display_name: string;    // UI display name
    org_display_name?: string;
    logo_url?: string;
};

export type MultiTenantConfig = {
    tenants: MultiTenantEntry[];
};

// Build-time injected values (see vite.config.ts)
declare const __TENANT_MODE__: TenantMode;
declare const __MULTI_TENANT_CONFIG__: MultiTenantConfig | null;

/**
 * Current tenant mode (build-time constant).
 */
export const TENANT_MODE: TenantMode = __TENANT_MODE__;

/**
 * Multi-tenant configuration (only available in multi-tenant mode).
 */
export const MULTI_TENANT_CONFIG: MultiTenantConfig | null = __MULTI_TENANT_CONFIG__;

/**
 * Check if running in single-tenant mode.
 */
export function isSingleTenant(): boolean {
    return TENANT_MODE === "single-tenant";
}

/**
 * Check if running in multi-tenant mode.
 */
export function isMultiTenant(): boolean {
    return TENANT_MODE === "multi-tenant";
}

/**
 * Get multi-tenant config, throwing if not in multi-tenant mode.
 * Use this to enforce multi-tenant context in code paths that require it.
 *
 * @throws Error if not in multi-tenant mode or config is missing
 */
export function requireMultiTenantConfig(): MultiTenantConfig {
    if (!isMultiTenant()) {
        throw new Error(
            "requireMultiTenantConfig() called but TENANT_MODE is not 'multi-tenant'"
        );
    }
    if (!MULTI_TENANT_CONFIG) {
        throw new Error(
            "Multi-tenant mode enabled but MULTI_TENANT_CONFIG is null"
        );
    }
    return MULTI_TENANT_CONFIG;
}

/**
 * Find tenant by URL path (multi-tenant mode only).
 *
 * @throws Error if not in multi-tenant mode
 */
export function findTenantByUrlPath(urlPath: string): MultiTenantEntry | undefined {
    const config = requireMultiTenantConfig();
    return config.tenants.find(t => t.url_path === urlPath);
}

/**
 * Get the data root path for the current tenant mode.
 *
 * Single-tenant: "/data" (no subdirectory)
 * Multi-tenant: "/data/<tenant-id>" (GUID-based subdirectory)
 */
export function getDataRootForMode(tenantId?: string): string {
    if (isSingleTenant()) {
        return "/data";
    }
    if (!tenantId) {
        throw new Error("tenantId is required in multi-tenant mode");
    }
    return `/data/${tenantId}`;
}
