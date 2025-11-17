import React from "react";
import { Outlet, useParams, Link as RouterLink } from "react-router-dom";
import { Box, Typography, Breadcrumbs } from "@mui/material";

export function RepoLayout() {
    const { orgSlug, appSlug, repoSlug } = useParams();

    return (
        <Box>
            <Breadcrumbs sx={{ mb: 2 }}>
                <RouterLink to={`/org/${orgSlug}`}>{orgSlug}</RouterLink>
                <RouterLink to={`/org/${orgSlug}/app/${appSlug}`}>{appSlug}</RouterLink>
                <Typography>{repoSlug}</Typography>
            </Breadcrumbs>

            <Outlet />
        </Box>
    );
}
