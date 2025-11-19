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
     * Resolves the data root path.
     * Requires tenant slugs (org, app, repo) to be provided - either via CLI arguments
     * or via defaults.json configuration.
     *
     * Always uses /data/<org>/<app>/<repo>/ structure for consistency between
     * single-tenant and multi-tenant deployments.
     */
    public Path resolveDataRoot(Path pagesRoot,
            String orgSlug,
            String appSlug,
            String repoSlug) throws IOException {
        Path base = pagesRoot.resolve("data");

        // Resolve tenant slugs: CLI arguments override defaults.json
        String org = (orgSlug != null && !orgSlug.isEmpty()) ? orgSlug : defaultOrg;
        String app = (appSlug != null && !appSlug.isEmpty()) ? appSlug : defaultApp;
        String repo = (repoSlug != null && !repoSlug.isEmpty()) ? repoSlug : defaultRepo;

        // Validate that we have all required slugs
        if (org == null || org.isEmpty() ||
            app == null || app.isEmpty() ||
            repo == null || repo.isEmpty()) {
            throw new IllegalArgumentException(
                "❌ ERROR: Tenant slugs (org, app, repo) are required.\n" +
                "   Provide them via:\n" +
                "   - CLI arguments: orgSlug appSlug repoSlug\n" +
                "   - workflow inputs: dashboard_org_slug, dashboard_app_slug, dashboard_repo_slug\n" +
                "   Current values: org=" + org + " app=" + app + " repo=" + repo
            );
        }

        Path tenantRoot = base.resolve(org).resolve(app).resolve(repo);
        Files.createDirectories(tenantRoot);
        System.out.println("   📁 Tenant data root: /data/" + org + "/" + app + "/" + repo);
        return tenantRoot;
    }
}
