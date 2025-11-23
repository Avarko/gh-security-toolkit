// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, symlinkSync, unlinkSync, readFileSync } from "node:fs";

/**
 * Dashboard configuration with build-time tenant mode.
 *
 * Single-tenant (default): TENANT_MODE unset or "single-tenant"
 * Multi-tenant: TENANT_MODE="multi-tenant" + MULTI_TENANT_CONFIG_PATH
 */

type TenantMode = "single-tenant" | "multi-tenant";

function getTenantMode(): TenantMode {
    const mode = process.env.TENANT_MODE;
    if (mode === "multi-tenant") return "multi-tenant";
    return "single-tenant";
}

function loadMultiTenantConfig(): object | null {
    const configPath = process.env.MULTI_TENANT_CONFIG_PATH;
    if (!configPath) return null;
    try {
        const content = readFileSync(configPath, "utf-8");
        return JSON.parse(content);
    } catch (error) {
        console.error(`Failed to load multi-tenant config: ${error}`);
        return null;
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function devTestDataPlugin() {
    function createSymlink(target: string, link: string, description: string) {
        if (existsSync(target)) {
            if (existsSync(link)) {
                try { unlinkSync(link); } catch { /* ignore */ }
            }
            try {
                symlinkSync(target, link, "dir");
                console.log(`Dev mode: Linked ${description}`);
            } catch {
                console.log(`Dev mode: ${description} symlink already exists`);
            }
        }
    }

    return {
        name: "dev-test-data",
        configureServer() {
            createSymlink(
                resolve(__dirname, "test-fixtures/data"),
                resolve(__dirname, "public/data"),
                "test-fixtures/data -> public/data"
            );
            createSymlink(
                resolve(__dirname, "test-fixtures/config"),
                resolve(__dirname, "public/config"),
                "test-fixtures/config -> public/config"
            );
        },
    };
}

export default defineConfig(({ command }) => {
    const tenantMode = getTenantMode();
    const multiTenantConfig = tenantMode === "multi-tenant" ? loadMultiTenantConfig() : null;

    console.log(`Building with TENANT_MODE=${tenantMode}`);
    if (multiTenantConfig) {
        const tenants = (multiTenantConfig as { tenants?: unknown[] }).tenants;
        console.log(`Multi-tenant config: ${tenants?.length ?? 0} tenant(s)`);
    }

    return {
        plugins: [react(), ...(command === "serve" ? [devTestDataPlugin()] : [])],
        base: "/",
        optimizeDeps: {
            include: [
                // Pre-bundle ECharts for better tree-shaking
                'echarts-for-react'
            ]
        },
        esbuild: {
            // Enable tree-shaking for better bundle optimization
            treeShaking: true,
        },
        build: {
            outDir: "dist",
            emptyOutDir: true,
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        // Separate ECharts into its own chunk for better caching
                        if (id.includes('echarts')) {
                            return 'echarts';
                        }
                        // MUI in its own chunk
                        if (id.includes('@mui')) {
                            return 'mui';
                        }
                        // React ecosystem in vendor chunk
                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                    }
                }
            },
            // Increase chunk size warning limit
            chunkSizeWarningLimit: 1000,
        },
        define: {
            // Build-time tenant mode constants
            __TENANT_MODE__: JSON.stringify(tenantMode),
            __MULTI_TENANT_CONFIG__: JSON.stringify(multiTenantConfig),
        },
    };
});
