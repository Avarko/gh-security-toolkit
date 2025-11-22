// src/config/tenantMode.ts
/**
 * Tenant mode configuration.
 *
 * This application is SINGLE-TENANT ONLY.
 * Data is stored directly at /data/ without UUID subdirectories.
 * Each GitHub repository has its own private Pages site.
 */

/**
 * Get the data root path.
 * In single-tenant mode, always returns "/data".
 */
export function getDataRoot(): string {
    return "/data";
}
