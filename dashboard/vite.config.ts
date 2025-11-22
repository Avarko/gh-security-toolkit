// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, symlinkSync, unlinkSync, readFileSync } from "node:fs";

/**
 * Dashboard configuration with build-time tenant mode.
 *
 * Data sources:
 * - VITE_DATA_SOURCE=localstack: Use LocalStack S3 buckets (development)
 * - VITE_DATA_SOURCE unset: Use symlinked test-fixtures (default dev mode)
 *
 * Tenant modes:
 * - Single-tenant (default): TENANT_MODE unset or "single-tenant"
 * - Multi-tenant: TENANT_MODE="multi-tenant" + MULTI_TENANT_CONFIG_PATH
 */

type TenantMode = "single-tenant" | "multi-tenant";
type DataSource = "symlink" | "localstack";

function getTenantMode(): TenantMode {
    const mode = process.env.TENANT_MODE;
    if (mode === "multi-tenant") return "multi-tenant";
    // LocalStack mode implies multi-tenant
    if (process.env.VITE_DATA_SOURCE === "localstack") return "multi-tenant";
    return "single-tenant";
}

function getDataSource(): DataSource {
    return process.env.VITE_DATA_SOURCE === "localstack" ? "localstack" : "symlink";
}

function loadMultiTenantConfig(): object | null {
    // For LocalStack mode, use localstack-config/tenant-registry.json
    if (process.env.VITE_DATA_SOURCE === "localstack") {
        const localstackConfig = resolve(dirname(fileURLToPath(import.meta.url)), "localstack-config/tenant-registry.json");
        if (existsSync(localstackConfig)) {
            try {
                const content = readFileSync(localstackConfig, "utf-8");
                return JSON.parse(content);
            } catch (error) {
                console.error(`Failed to load LocalStack config: ${error}`);
            }
        }
    }

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
            // Skip symlinks in LocalStack mode - data comes from S3
            if (process.env.VITE_DATA_SOURCE === "localstack") {
                console.log("Dev mode: Using LocalStack S3 for data (no symlinks)");
                return;
            }
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
    const dataSource = getDataSource();
    const multiTenantConfig = tenantMode === "multi-tenant" ? loadMultiTenantConfig() : null;

    console.log(`Building with TENANT_MODE=${tenantMode}, DATA_SOURCE=${dataSource}`);
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
            __DATA_SOURCE__: JSON.stringify(dataSource),
        },
    };
});
