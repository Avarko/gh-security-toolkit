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
    | { mode: "multi-tenant" }  // ei defaults.jsonia → nätti 404
    | { mode: "single-tenant" }; // ei koskaan päädy komponenttiin, koska redirect

export async function loader(_args: LoaderFunctionArgs): Promise<Response | LoaderData> {
    try {
        const res = await fetch("/data/defaults.json", {
            // halutessasi voit poistaa cachetuksen:
            // cache: "no-store",
        });

        if (!res.ok) {
            // Ei defaults.jsonia → multi-tenant
            return { mode: "multi-tenant" };
        }

        const json = (await res.json()) as DefaultsConfig;

        if (!json.defaultOrg || !json.defaultApp) {
            console.error("Invalid defaults.json, falling back to multi-tenant mode");
            return { mode: "multi-tenant" };
        }

        const { defaultOrg, defaultApp, defaultRepo } = json;

        const target =
            defaultRepo
                ? `/org/${defaultOrg}/app/${defaultApp}/repo/${defaultRepo}`
                : `/org/${defaultOrg}/app/${defaultApp}`;

        // Tässä tehdään "oikealta tuntuva" redirect: URL muuttuu selaimessa
        return redirect(target);
    } catch (error) {
        console.error("Error loading defaults.json, falling back to multi-tenant mode:", error);
        return { mode: "multi-tenant" };
    }
}

export default function RootIndex() {
    // Tänne päädytään vain, jos loader ei tehnyt redirectiä → multi-tenant-tilanne
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
                    404 – Ei oletusorganisaatiota
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                    Tämä instanssi on konfiguroitu multi-tenant-käyttöön, eikä juuripolulle ("/")
                    ole määritelty oletusorganisaatiota tai sovellusta.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                    Avaa suoraan organisaatiokohtainen osoite, esimerkiksi:
                    <br />
                    <code>/org/&lt;orgSlug&gt;/app/&lt;appSlug&gt;</code>
                </Typography>
            </Box>
        );
    }

    // loaderin redirect-polussa komponenttia ei koskaan renderöidä
    return null;
}
