// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, symlinkSync, unlinkSync, readFileSync } from "node:fs";

/**
 * Tenant Mode Configuration
 *
 * Build-time configuration for single-tenant vs multi-tenant deployments:
 *
 * SINGLE-TENANT (default, GitHub Pages):
 *   - Set TENANT_MODE=single-tenant or leave unset
 *   - Data stored at /data/ (no subdirectories)
 *   - No tenant registry needed
 *   - URLs: /security-scans/channel/...
 *
 * MULTI-TENANT (S3/CDN deployments):
 *   - Set TENANT_MODE=multi-tenant
 *   - Set MULTI_TENANT_CONFIG_PATH to JSON file with tenant config
 *   - Data stored at /data/<uuid>/ per tenant
 *   - URLs: /<tenant-url-path>/security-scans/channel/...
 *
 * Example multi-tenant config (admin-managed):
 * {
 *   "tenants": [
 *     {
 *       "id": "66483d2f-...",
 *       "github_org": "finnishrail",
 *       "github_repo": "app-fc-ciam-backend",
 *       "url_path": "fr-ciam",
 *       "display_name": "Finnish Rail CIAM"
 *     }
 *   ]
 * }
 */

type TenantMode = "single-tenant" | "multi-tenant";

function loadMultiTenantConfig(): object | null {
    const configPath = process.env.MULTI_TENANT_CONFIG_PATH;
    if (!configPath) {
        return null;
    }
    try {
        const content = readFileSync(configPath, "utf-8");
        return JSON.parse(content);
    } catch (error) {
        console.error(`Failed to load multi-tenant config from ${configPath}:`, error);
        return null;
    }
}

function getTenantMode(): TenantMode {
    const mode = process.env.TENANT_MODE;
    if (mode === "multi-tenant") {
        return "multi-tenant";
    }
    return "single-tenant";
}

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

export default defineConfig(({ command }) => {
    const tenantMode = getTenantMode();
    const multiTenantConfig = tenantMode === "multi-tenant" ? loadMultiTenantConfig() : null;

    console.log(`Building with TENANT_MODE=${tenantMode}`);
    if (multiTenantConfig) {
        console.log(`Multi-tenant config loaded with ${(multiTenantConfig as { tenants: unknown[] }).tenants?.length || 0} tenant(s)`);
    }

    return {
        plugins: [react(), ...(command === "serve" ? [devTestDataPlugin()] : [])],
        base: "/",
        build: {
            outDir: "dist",
            emptyOutDir: true,
        },
        define: {
            // Build-time constants for tenant mode
            // These are replaced at compile time, not runtime
            __TENANT_MODE__: JSON.stringify(tenantMode),
            __MULTI_TENANT_CONFIG__: JSON.stringify(multiTenantConfig),
        },
    };
});
