// src/context/TenantContext.tsx
/**
 * Tenant context for unified single/multi-tenant routing.
 *
 * Provides dataRoot path to all child components:
 * - Single-tenant: "/data"
 * - Multi-tenant: "/data/<uuid>"
 */
import { createContext, useContext, type ReactNode } from "react";

export type TenantInfo = {
    /** Data root path (e.g., "/data" or "/data/<uuid>") */
    dataRoot: string;
    /** Tenant display name (multi-tenant only) */
    displayName?: string;
    /** Organization display name (multi-tenant only) */
    orgDisplayName?: string;
    /** Logo URL (multi-tenant only) */
    logoUrl?: string;
};

const TenantContext = createContext<TenantInfo | null>(null);

type TenantProviderProps = {
    tenant: TenantInfo;
    children: ReactNode;
};

/**
 * Provider for tenant context.
 * In single-tenant mode, wrap at router level with dataRoot="/data".
 * In multi-tenant mode, wrap after tenant resolution with dataRoot="/data/<uuid>".
 */
export function TenantProvider({ tenant, children }: TenantProviderProps) {
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
