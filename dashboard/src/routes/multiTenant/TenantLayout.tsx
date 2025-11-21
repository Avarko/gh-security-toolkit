// src/routes/multiTenant/TenantLayout.tsx
/**
 * Tenant layout wrapper for multi-tenant mode.
 *
 * Resolves the tenant from URL path and provides tenant context to child routes.
 * Throws 404 if tenant is not found in configuration.
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { Outlet, useLoaderData } from "react-router-dom";
import { Container, Typography } from "@mui/material";
import { createContext, useContext } from "react";
import { findTenantByUrlPath, type MultiTenantEntry } from "../../config/tenantMode";

// Tenant context for child components
type TenantContextValue = {
    tenant: MultiTenantEntry;
    dataRoot: string;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant(): TenantContextValue {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error("useTenant must be used within TenantLayout");
    }
    return context;
}

type LoaderData =
    | { found: true; tenant: MultiTenantEntry; dataRoot: string }
    | { found: false; tenantPath: string };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { tenantPath } = args.params;

    if (!tenantPath) {
        return { found: false, tenantPath: "(missing)" };
    }

    const tenant = findTenantByUrlPath(tenantPath);

    if (!tenant) {
        return { found: false, tenantPath };
    }

    // Data root uses the GUID, not the URL path
    const dataRoot = `/data/${tenant.id}`;

    return { found: true, tenant, dataRoot };
}

export default function TenantLayout() {
    const data = useLoaderData() as LoaderData;

    if (!data.found) {
        return (
            <Container maxWidth="md" sx={{ mt: 8, textAlign: "center" }}>
                <Typography variant="h3" gutterBottom>
                    404 - Tenant not found
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    No tenant configured for path: <code>{data.tenantPath}</code>
                </Typography>
            </Container>
        );
    }

    return (
        <TenantContext.Provider
            value={{ tenant: data.tenant, dataRoot: data.dataRoot }}
        >
            <Outlet />
        </TenantContext.Provider>
    );
}
