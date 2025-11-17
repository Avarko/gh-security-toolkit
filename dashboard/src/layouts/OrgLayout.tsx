import React from "react";
import { Outlet, useParams, Link as RouterLink } from "react-router-dom";
import { Box, Drawer, Toolbar, List, ListItemButton, ListItemText, Typography } from "@mui/material";

import { getAppsForOrg } from "../mock/data";

const DRAWER_WIDTH = 240;

export function OrgLayout() {
    const { orgSlug } = useParams();
    const apps = getAppsForOrg(orgSlug!);

    return (
        <Box sx={{ display: "flex" }}>
            <Drawer
                variant="permanent"
                sx={{
                    width: DRAWER_WIDTH,
                    "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
                }}
            >
                <Toolbar>
                    <Typography variant="h6" fontWeight={700}>
                        {orgSlug}
                    </Typography>
                </Toolbar>
                <List>
                    {apps.map(a => (
                        <ListItemButton
                            key={a.appSlug}
                            component={RouterLink}
                            to={`app/${a.appSlug}`}
                        >
                            <ListItemText primary={a.name} />
                        </ListItemButton>
                    ))}
                </List>
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                <Toolbar />
                <Outlet />
            </Box>
        </Box>
    );
}
