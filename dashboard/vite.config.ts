// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    // Jos hostaat juuren alla (esim. https://example.com/), base voi olla oletus.
    // Jos joskus hostaat alihakemistossa (esim. /gh-security-toolkit/), muuta base-arvoa.
    base: "/",
    resolve: {
        alias: {},
    },
    build: {
        outDir: "build/client",
        emptyOutDir: true,
    },
});
