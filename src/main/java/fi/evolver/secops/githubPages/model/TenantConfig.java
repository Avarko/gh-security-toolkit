package fi.evolver.secops.githubPages.model;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Tenant configuration that matches the structure of data/defaults.json
 * and can resolve the data root.
 */
public final class TenantConfig {

    private static final Gson GSON = new GsonBuilder().create();

    public String mode;
    public String defaultOrg;
    public String defaultApp;
    public String defaultRepo;

    /**
     * Loads defaults.json if it exists. Otherwise returns
     * a default configuration (mode="multi-tenant").
     */
    public static TenantConfig loadOrDefault(Path pagesRoot) {
        Path defaults = pagesRoot.resolve("data").resolve("defaults.json");
        if (!Files.exists(defaults)) {
            TenantConfig cfg = new TenantConfig();
            cfg.mode = "multi-tenant";
            return cfg;
        }
        try {
            String json = Files.readString(defaults, StandardCharsets.UTF_8);
            TenantConfig cfg = GSON.fromJson(json, TenantConfig.class);
            if (cfg == null) {
                cfg = new TenantConfig();
                cfg.mode = "multi-tenant";
            }
            return cfg;
        } catch (IOException e) {
            System.err.println("⚠️  Failed to read defaults.json, using legacy data root: " + e.getMessage());
            TenantConfig cfg = new TenantConfig();
            cfg.mode = "multi-tenant";
            return cfg;
        }
    }

    /**
     * Resolves the data root:
     * 1) If CLI slugs are provided → data/<org>/<app>/<repo>
     * 2) Otherwise if defaults.json has mode == single-tenant and
     * defaultOrg/App/Repo are present
     * 3) Otherwise legacy: data/
     */
    public Path resolveDataRoot(Path pagesRoot,
            String orgSlug,
            String appSlug,
            String repoSlug) throws IOException {
        Path base = pagesRoot.resolve("data");

        // 1) CLI-argumentit voittavat kaiken muun
        if (orgSlug != null && appSlug != null && repoSlug != null) {
            Path tenantRoot = base.resolve(orgSlug).resolve(appSlug).resolve(repoSlug);
            Files.createDirectories(tenantRoot);
            System.out.println("   Tenant data root (from args): " + tenantRoot);
            return tenantRoot;
        }

        // 2) defaults.json single-tenant mode
        if ("single-tenant".equalsIgnoreCase(mode)
                && defaultOrg != null
                && defaultApp != null
                && defaultRepo != null) {
            Path tenantRoot = base.resolve(defaultOrg).resolve(defaultApp).resolve(defaultRepo);
            Files.createDirectories(tenantRoot);
            System.out.println("   Tenant data root (from defaults.json): " + tenantRoot);
            return tenantRoot;
        }

        // 3) fallback: legacy /data
        Files.createDirectories(base);
        System.out.println("   ⚠️  No tenant slugs available - using legacy data layout under: " + base);
        return base;
    }
}
