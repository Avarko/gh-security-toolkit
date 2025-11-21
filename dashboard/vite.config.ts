// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, symlinkSync, unlinkSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In dev mode, create symlinks for test data and config
// This allows the dev server to serve test data without including it in production builds
function devTestDataPlugin() {
    function createSymlink(target: string, link: string, description: string) {
        if (existsSync(target)) {
            // Remove existing symlink/directory if present
            if (existsSync(link)) {
                try {
                    unlinkSync(link);
                } catch {
                    // Directory might exist, ignore
                }
            }

            try {
                symlinkSync(target, link, "dir");
                console.log(`📁 Dev mode: Linked ${description}`);
            } catch {
                console.log(`📁 Dev mode: ${description} symlink already exists or cannot be created`);
            }
        }
    }

    return {
        name: "dev-test-data",
        configureServer() {
            // Link test-fixtures/data -> public/data
            createSymlink(
                resolve(__dirname, "test-fixtures/data"),
                resolve(__dirname, "public/data"),
                "test-fixtures/data -> public/data"
            );

            // Link test-fixtures/config -> public/config
            createSymlink(
                resolve(__dirname, "test-fixtures/config"),
                resolve(__dirname, "public/config"),
                "test-fixtures/config -> public/config"
            );
        },
    };
}

export default defineConfig(({ command }) => ({
    plugins: [react(), ...(command === "serve" ? [devTestDataPlugin()] : [])],
    base: "/",
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
}));
