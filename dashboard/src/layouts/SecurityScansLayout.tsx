import { Outlet, useParams, Link as RouterLink } from "react-router-dom";
import { Box, Breadcrumbs, Typography } from "@mui/material";

export default function SecurityScansLayout() {
    const { orgSlug, repoSlug } = useParams();

    return (
        <Box>
            <Breadcrumbs sx={{ mb: 2 }}>
                <RouterLink to={`/org/${orgSlug}`}>{orgSlug}</RouterLink>
                <RouterLink to={`/org/${orgSlug}/repo/${repoSlug}`}>
                    {repoSlug}
                </RouterLink>
                <Typography>Security Scans</Typography>
            </Breadcrumbs>

            <Outlet />
        </Box>
    );
}
