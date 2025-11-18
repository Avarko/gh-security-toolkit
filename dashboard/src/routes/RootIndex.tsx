// src/routes/RootIndex.tsx
import type { LoaderFunctionArgs } from "react-router-dom";
import { redirect, useLoaderData } from "react-router-dom";
import { Box, Typography } from "@mui/material";

type DefaultsConfig = {
    mode?: "single-tenant" | "multi-tenant";
    defaultOrg?: string;
    defaultApp?: string;
    defaultRepo?: string;
};

type LoaderData =
    | { mode: "multi-tenant" }  // If no defaults.json → pretty 404
    | { mode: "single-tenant" }; // never reaches component because of redirect

export async function loader(_args: LoaderFunctionArgs): Promise<Response | LoaderData> {
    try {
        const res = await fetch("/data/defaults.json", {
            // If you want, you can disable caching:
            // cache: "no-store",
        });

        if (!res.ok) {
            // No defaults.json → multi-tenant
            return { mode: "multi-tenant" };
        }

        const json = (await res.json()) as DefaultsConfig;

        if (!json.defaultOrg || !json.defaultApp) {
            console.error("Invalid defaults.json, falling back to multi-tenant mode");
            return { mode: "multi-tenant" };
        }

        const { defaultOrg, defaultApp, defaultRepo } = json;

        const base = defaultRepo
            ? `/org/${defaultOrg}/app/${defaultApp}/repo/${defaultRepo}`
            : `/org/${defaultOrg}/app/${defaultApp}`;

        const target = `${base}/security-scans`;

        return redirect(target);
    } catch (error) {
        console.error("Error loading defaults.json, falling back to multi-tenant mode:", error);
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
                    <code>/org/&lt;orgSlug&gt;/app/&lt;appSlug&gt;</code>
                </Typography>
            </Box>
        );
    }
    return null;
}
