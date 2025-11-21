// src/routes/multiTenant/RootIndex.tsx
/**
 * Root index route for multi-tenant mode.
 *
 * Shows tenant selector if multiple tenants, or 404 if none.
 * In production, this would typically show a list of available tenants
 * or redirect to a default tenant.
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData, Link } from "react-router-dom";
import { Box, Typography, List, ListItem, ListItemButton, ListItemText, Container } from "@mui/material";
import { requireMultiTenantConfig, type MultiTenantEntry } from "../../config/tenantMode";

type LoaderData = {
    tenants: MultiTenantEntry[];
};

export async function loader(_args: LoaderFunctionArgs): Promise<LoaderData> {
    const config = requireMultiTenantConfig();
    return { tenants: config.tenants };
}

export default function MultiTenantRootIndex() {
    const { tenants } = useLoaderData() as LoaderData;

    if (tenants.length === 0) {
        return (
            <Container maxWidth="md" sx={{ mt: 8, textAlign: "center" }}>
                <Typography variant="h3" gutterBottom>
                    No tenants configured
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    This multi-tenant instance has no tenants configured.
                    Contact an administrator.
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom>
                Select Organization
            </Typography>
            <List>
                {tenants.map((tenant) => (
                    <ListItem key={tenant.id} disablePadding>
                        <ListItemButton
                            component={Link}
                            to={`/${tenant.url_path}/security-scans`}
                        >
                            <ListItemText
                                primary={tenant.display_name}
                                secondary={tenant.org_display_name || `${tenant.github_org}/${tenant.github_repo}`}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Container>
    );
}
