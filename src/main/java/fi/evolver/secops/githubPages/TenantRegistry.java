package fi.evolver.secops.githubPages;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Manages tenant registry mapping GitHub org/repo pairs to UUIDs.
 *
 * Security model:
 * - GitHub Actions context variables (GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY) are trusted sources
 * - Tenant identity determined solely by GitHub, not client-provided data
 * - Data stored at /data/<uuid>/ to prevent tenant forgery or path traversal
 * - Display metadata stored separately in registry
 */
public class TenantRegistry {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Pattern VALID_GITHUB_NAME = Pattern.compile("^[a-zA-Z0-9._-]+$");

    // Reserved names that cannot be used as org/repo names
    private static final List<String> RESERVED_NAMES = List.of(
        ".", "..", "config", "api", "www", "cdn", "assets", "static"
    );

    private final Path registryPath;
    private final List<TenantEntry> tenants;

    /**
     * Loads the tenant registry from the specified path.
     * Creates a new empty registry if the file doesn't exist.
     */
    public TenantRegistry(Path pagesRoot) throws IOException {
        this.registryPath = pagesRoot.resolve("config").resolve("tenant-registry.json");
        this.tenants = new ArrayList<>();

        // Create config directory if it doesn't exist
        Files.createDirectories(registryPath.getParent());

        // Load existing registry or create new one
        if (Files.exists(registryPath)) {
            loadRegistry();
        } else {
            System.out.println("📝 Creating new tenant registry at: " + registryPath);
            saveRegistry();
        }
    }

    /**
     * Resolves or creates a tenant UUID for the given GitHub org/repo pair.
     *
     * @param githubOrg GitHub organization or user name (from GITHUB_REPOSITORY_OWNER)
     * @param githubRepo GitHub repository name (from GITHUB_REPOSITORY)
     * @param displayName Optional display name for the tenant
     * @param orgDisplayName Optional organization display name
     * @param logoUrl Optional logo URL
     * @return UUID for the tenant's data directory
     */
    public String resolveTenantId(String githubOrg, String githubRepo, String displayName, String orgDisplayName, String logoUrl) throws IOException {
        // Normalize and validate inputs
        String normalizedOrg = normalizeGitHubName(githubOrg);
        String normalizedRepo = normalizeGitHubName(githubRepo);

        validateGitHubName(normalizedOrg, "GitHub organization");
        validateGitHubName(normalizedRepo, "GitHub repository");

        // Look up existing tenant
        for (TenantEntry tenant : tenants) {
            if (tenant.githubOrg.equals(normalizedOrg) && tenant.githubRepo.equals(normalizedRepo)) {
                System.out.println("✅ Found existing tenant: " + normalizedOrg + "/" + normalizedRepo + " → " + tenant.id);

                // Update display metadata if provided (but don't remove existing values)
                boolean updated = false;
                if (displayName != null && !displayName.equals(tenant.displayName)) {
                    tenant.displayName = displayName;
                    updated = true;
                }
                if (orgDisplayName != null && !orgDisplayName.equals(tenant.orgDisplayName)) {
                    tenant.orgDisplayName = orgDisplayName;
                    updated = true;
                }
                if (logoUrl != null && !logoUrl.equals(tenant.logoUrl)) {
                    tenant.logoUrl = logoUrl;
                    updated = true;
                }

                if (updated) {
                    saveRegistry();
                    System.out.println("📝 Updated tenant display metadata");
                }

                return tenant.id;
            }
        }

        // Create new tenant
        String uuid = UUID.randomUUID().toString();
        TenantEntry newTenant = new TenantEntry(
            uuid,
            normalizedOrg,
            normalizedRepo,
            Instant.now().toString(),
            displayName,
            orgDisplayName,
            logoUrl
        );

        tenants.add(newTenant);
        saveRegistry();

        System.out.println("🆕 Created new tenant: " + normalizedOrg + "/" + normalizedRepo + " → " + uuid);
        return uuid;
    }

    /**
     * Normalizes GitHub org/repo name to lowercase for case-insensitive comparison.
     * GitHub is case-insensitive but case-preserving, so we normalize for storage.
     */
    private String normalizeGitHubName(String name) {
        if (name == null) {
            throw new IllegalArgumentException("GitHub org/repo name cannot be null");
        }
        return name.toLowerCase().trim();
    }

    /**
     * Validates that a GitHub org/repo name is safe and follows GitHub's naming rules.
     *
     * Security checks:
     * - Only alphanumeric, dash, underscore, dot allowed
     * - No path traversal sequences
     * - No reserved names
     * - Not empty
     */
    private void validateGitHubName(String name, String fieldName) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException(fieldName + " cannot be empty");
        }

        if (!VALID_GITHUB_NAME.matcher(name).matches()) {
            throw new IllegalArgumentException(
                fieldName + " contains invalid characters: " + name +
                " (allowed: a-z, A-Z, 0-9, -, _, .)"
            );
        }

        if (RESERVED_NAMES.contains(name)) {
            throw new IllegalArgumentException(
                fieldName + " uses reserved name: " + name
            );
        }

        if (name.contains("..") || name.startsWith(".")) {
            throw new IllegalArgumentException(
                fieldName + " contains invalid sequence: " + name
            );
        }
    }

    /**
     * Loads the tenant registry from JSON file.
     */
    private void loadRegistry() throws IOException {
        String json = Files.readString(registryPath, StandardCharsets.UTF_8);
        JsonObject root = GSON.fromJson(json, JsonObject.class);

        if (root == null || !root.has("tenants")) {
            System.out.println("⚠️  Registry file exists but has no tenants array, initializing empty");
            return;
        }

        JsonArray tenantsArray = root.getAsJsonArray("tenants");
        for (int i = 0; i < tenantsArray.size(); i++) {
            JsonObject tenantObj = tenantsArray.get(i).getAsJsonObject();
            TenantEntry entry = new TenantEntry(
                tenantObj.get("id").getAsString(),
                tenantObj.get("github_org").getAsString(),
                tenantObj.get("github_repo").getAsString(),
                tenantObj.get("created_at").getAsString(),
                tenantObj.has("display_name") ? tenantObj.get("display_name").getAsString() : null,
                tenantObj.has("org_display_name") ? tenantObj.get("org_display_name").getAsString() : null,
                tenantObj.has("logo_url") ? tenantObj.get("logo_url").getAsString() : null
            );
            tenants.add(entry);
        }

        System.out.println("📖 Loaded " + tenants.size() + " tenant(s) from registry");
    }

    /**
     * Returns list of all registered tenant IDs.
     * Used for cleanup of orphaned tenant directories.
     */
    public List<String> getRegisteredTenantIds() {
        List<String> ids = new ArrayList<>();
        for (TenantEntry tenant : tenants) {
            if (tenant.id != null && !tenant.id.isEmpty()) {
                ids.add(tenant.id);
            }
        }
        return ids;
    }

    /**
     * Checks if the registry has any tenants registered.
     */
    public boolean isEmpty() {
        return tenants.isEmpty();
    }

    /**
     * Saves the tenant registry to JSON file.
     */
    private void saveRegistry() throws IOException {
        JsonObject root = new JsonObject();
        JsonArray tenantsArray = new JsonArray();

        for (TenantEntry tenant : tenants) {
            JsonObject tenantObj = new JsonObject();
            tenantObj.addProperty("id", tenant.id);
            tenantObj.addProperty("github_org", tenant.githubOrg);
            tenantObj.addProperty("github_repo", tenant.githubRepo);
            tenantObj.addProperty("created_at", tenant.createdAt);

            // Only include display metadata if provided
            if (tenant.displayName != null && !tenant.displayName.isEmpty()) {
                tenantObj.addProperty("display_name", tenant.displayName);
            }
            if (tenant.orgDisplayName != null && !tenant.orgDisplayName.isEmpty()) {
                tenantObj.addProperty("org_display_name", tenant.orgDisplayName);
            }
            if (tenant.logoUrl != null && !tenant.logoUrl.isEmpty()) {
                tenantObj.addProperty("logo_url", tenant.logoUrl);
            }

            tenantsArray.add(tenantObj);
        }

        root.add("tenants", tenantsArray);

        String json = GSON.toJson(root);
        Files.writeString(registryPath, json, StandardCharsets.UTF_8);
    }

    /**
     * Internal representation of a tenant registry entry.
     */
    private static class TenantEntry {
        final String id;
        final String githubOrg;
        final String githubRepo;
        final String createdAt;
        String displayName;
        String orgDisplayName;
        String logoUrl;

        TenantEntry(String id, String githubOrg, String githubRepo, String createdAt,
                   String displayName, String orgDisplayName, String logoUrl) {
            this.id = id;
            this.githubOrg = githubOrg;
            this.githubRepo = githubRepo;
            this.createdAt = createdAt;
            this.displayName = displayName;
            this.orgDisplayName = orgDisplayName;
            this.logoUrl = logoUrl;
        }
    }
}
