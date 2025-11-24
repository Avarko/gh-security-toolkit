// src/context/TenantContext.tsx
/**
 * Tenant context for unified single/multi-tenant routing and branding.
 *
 * Provides dataRoot path and organization branding to all child components:
 * - Single-tenant: "/data" + org branding from tenant-registry.json
 * - Multi-tenant: "/data/<uuid>" + tenant branding from config
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { isSingleTenant } from "../config/tenantMode";
import { getSingleTenantInfo, type TenantRegistryEntry } from "../lib/tenantRegistry";

export type TenantInfo = {
    /** Data root path (e.g., "/data" or "/data/<uuid>") */
    dataRoot: string;
    /** Tenant display name (multi-tenant only) */
    displayName?: string;
    /** Organization display name */
    orgDisplayName?: string;
    /** Logo URL */
    logoUrl?: string;
    /** GitHub organization */
    githubOrg?: string;
    /** GitHub repository */
    githubRepo?: string;
};

const TenantContext = createContext<TenantInfo | null>(null);

type TenantProviderProps = {
    tenant: TenantInfo;
    children: ReactNode;
};

/**
 * Provider for tenant context with async organization branding loading.
 * In single-tenant mode, loads additional branding from tenant-registry.json.
 * In multi-tenant mode, uses provided tenant branding.
 */
export function TenantProvider({ tenant: initialTenant, children }: TenantProviderProps) {
    const [tenant, setTenant] = useState<TenantInfo>(initialTenant);

    // Load single-tenant organization branding
    useEffect(() => {
        if (isSingleTenant()) {
            getSingleTenantInfo().then((registryInfo) => {
                if (registryInfo) {
                    setTenant(prev => ({
                        ...prev,
                        orgDisplayName: registryInfo.org_display_name,
                        logoUrl: registryInfo.logo_url,
                        githubOrg: registryInfo.github_org,
                        githubRepo: registryInfo.github_repo,
                        displayName: registryInfo.display_name,
                    }));
                }
            });
        }
    }, []);

    return (
        <TenantContext.Provider value={tenant}>
            {children}
        </TenantContext.Provider>
    );
}

/**
 * Hook to access tenant info.
 * @throws Error if used outside TenantProvider
 */
export function useTenant(): TenantInfo {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error("useTenant must be used within a TenantProvider");
    }
    return context;
}

/**
 * Hook to access data root path.
 * Convenience wrapper around useTenant().
 */
export function useDataRoot(): string {
    return useTenant().dataRoot;
}
