import { Outlet, useParams, Link as RouterLink } from "react-router-dom";
import { Box, Breadcrumbs, Typography } from "@mui/material";

export default function SecurityScansLayout() {
    const { orgSlug, appSlug, repoSlug } = useParams();

    const base = repoSlug
        ? `/org/${orgSlug}/app/${appSlug}/repo/${repoSlug}/security-scans`
        : `/org/${orgSlug}/app/${appSlug}/security-scans`;

    return (
        <Box>
            <Breadcrumbs sx={{ mb: 2 }}>
                <RouterLink to={`/org/${orgSlug}`}>{orgSlug}</RouterLink>
                <RouterLink to={`/org/${orgSlug}/app/${appSlug}`}>{appSlug}</RouterLink>
                {repoSlug && (
                    <RouterLink to={`/org/${orgSlug}/app/${appSlug}/repo/${repoSlug}`}>
                        {repoSlug}
                    </RouterLink>
                )}
                <Typography>Security Scans</Typography>
            </Breadcrumbs>

            <Outlet />
        </Box>
    );
}
