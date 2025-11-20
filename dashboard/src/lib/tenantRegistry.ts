// src/lib/tenantRegistry.ts

/**
 * Tenant registry entry matching the backend TenantRegistry structure.
 */
export type TenantEntry = {
    id: string; // UUID
    github_org: string; // Normalized (lowercase)
    github_repo: string; // Normalized (lowercase)
    created_at: string; // ISO 8601 timestamp
    display_name?: string; // Optional display name
    org_display_name?: string; // Optional org display name
    logo_url?: string; // Optional logo URL
};

export type TenantRegistry = {
    tenants: TenantEntry[];
};

/**
 * Loads the tenant registry from /config/tenant-registry.json
 */
export async function loadTenantRegistry(): Promise<TenantRegistry> {
    try {
        const res = await fetch("/config/tenant-registry.json");

        if (!res.ok) {
            console.warn("Tenant registry not found, returning empty registry");
            return { tenants: [] };
        }

        const registry = (await res.json()) as TenantRegistry;
        return registry || { tenants: [] };
    } catch (error) {
        console.error("Error loading tenant registry:", error);
        return { tenants: [] };
    }
}

/**
 * Finds a tenant by GitHub org/repo pair (case-insensitive).
 * Returns undefined if not found.
 */
export function findTenantByGitHub(
    registry: TenantRegistry,
    githubOrg: string,
    githubRepo: string
): TenantEntry | undefined {
    const normalizedOrg = githubOrg.toLowerCase();
    const normalizedRepo = githubRepo.toLowerCase();

    return registry.tenants.find(
        (t) =>
            t.github_org === normalizedOrg &&
            t.github_repo === normalizedRepo
    );
}

/**
 * Finds a tenant by UUID.
 * Returns undefined if not found.
 */
export function findTenantById(
    registry: TenantRegistry,
    tenantId: string
): TenantEntry | undefined {
    return registry.tenants.find((t) => t.id === tenantId);
}

/**
 * Generates the data path for a tenant: /data/<uuid>/
 */
export function getTenantDataPath(tenantId: string): string {
    return `/data/${tenantId}`;
}
