// src/routes/RootIndex.tsx
import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect, useLoaderData } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { loadTenantRegistry } from "../lib/tenantRegistry";

type LoaderData =
    | { mode: "multi-tenant" }  // Multiple or no tenants → show 404
    | { mode: "single-tenant" }; // Never reaches component because of redirect

export async function loader(_args: LoaderFunctionArgs): Promise<Response | LoaderData> {
    try {
        // Load tenant registry
        const registry = await loadTenantRegistry();

        // Single-tenant mode: exactly one tenant → redirect
        if (registry.tenants.length === 1) {
            const tenant = registry.tenants[0];

            if (tenant) {
                // Construct URL using GitHub org/repo (simplified routing without /app/)
                const target = `/org/${tenant.github_org}/repo/${tenant.github_repo}/security-scans`;

                return redirect(target);
            }
        }

        // Multi-tenant mode or no tenants → show 404
        return { mode: "multi-tenant" };
    } catch (error) {
        console.error("Error loading tenant registry:", error);
        return { mode: "multi-tenant" };
    }
}

export default function RootIndex() {
    const data = useLoaderData() as LoaderData;

    if (data.mode === "multi-tenant") {
        return (
            <Box
                sx={{
                    mt: 8,
                    textAlign: "center",
                }}
            >
                <Typography variant="h3" gutterBottom>
                    404 – No default organization
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                    This instance is configured for multi-tenant use, and no default organization or application
                    is defined for the root path ("/").
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                    Open a direct organization-specific address, for example:
                    <br />
                    <code>/org/&lt;github-org&gt;/repo/&lt;github-repo&gt;</code>
                </Typography>
            </Box>
        );
    }
    return null;
}
