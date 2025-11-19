import React from "react";
import { Outlet, useParams, Link as RouterLink } from "react-router-dom";
import { Box, Typography, Breadcrumbs } from "@mui/material";

export function RepoLayout() {
    const { orgSlug, repoSlug } = useParams();

    return (
        <Box>
            <Breadcrumbs sx={{ mb: 2 }}>
                <RouterLink to={`/org/${orgSlug}`}>{orgSlug}</RouterLink>
                <Typography>{repoSlug}</Typography>
            </Breadcrumbs>

            <Outlet />
        </Box>
    );
}
