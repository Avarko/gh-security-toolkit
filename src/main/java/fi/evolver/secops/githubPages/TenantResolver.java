package fi.evolver.secops.githubPages;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Resolves tenant identity from GitHub context and manages tenant directories.
 * Stateless utility class with static methods.
 */
public final class TenantResolver {

    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

    private TenantResolver() {
        // Utility class - no instantiation
    }

    /**
     * Result of tenant resolution containing tenant ID and data root path.
     */
    public static class TenantInfo {
        public final String tenantId;
        public final Path dataRoot;

        public TenantInfo(String tenantId, Path dataRoot) {
            this.tenantId = tenantId;
            this.dataRoot = dataRoot;
        }
    }

    /**
     * Reads GitHub org/repo from environment variables and resolves tenant.
     *
     * @param pagesPath Root path for GitHub Pages
     * @return TenantInfo with resolved tenant ID and data root
     * @throws IOException if registry operations fail
     * @throws IllegalArgumentException if environment variables are missing
     */
    public static TenantInfo resolve(Path pagesPath) throws IOException {
        String githubOrg = System.getenv("GITHUB_REPOSITORY_OWNER");
        String githubRepo = System.getenv("GITHUB_REPOSITORY");

        // GITHUB_REPOSITORY is in format "owner/repo", extract just the repo name
        if (githubRepo != null && githubRepo.contains("/")) {
            githubRepo = githubRepo.substring(githubRepo.lastIndexOf("/") + 1);
        }

        validateEnvironment(githubOrg, githubRepo);

        System.out.println("🔐 Tenant identity (from GitHub Actions context):");
        System.out.println("   GitHub org: " + githubOrg);
        System.out.println("   GitHub repo: " + githubRepo);

        // Resolve or create tenant UUID using TenantRegistry
        TenantRegistry registry = new TenantRegistry(pagesPath);
        String tenantId = registry.resolveTenantId(githubOrg, githubRepo, null, null, null);

        // Data root is /data/<uuid>/
        Path dataRoot = pagesPath.resolve("data").resolve(tenantId);
        Files.createDirectories(dataRoot);
        System.out.println("📁 Tenant data root: /data/" + tenantId + "/");

        // Clean up orphaned tenants
        cleanupOrphanedTenants(pagesPath, registry);

        return new TenantInfo(tenantId, dataRoot);
    }

    /**
     * Validates that required GitHub environment variables are set.
     */
    private static void validateEnvironment(String githubOrg, String githubRepo) {
        if (githubOrg == null || githubOrg.isEmpty()) {
            throw new IllegalArgumentException(
                    "❌ ERROR: GITHUB_REPOSITORY_OWNER environment variable is required.\n" +
                            "   This value is trusted and provided by GitHub Actions.\n" +
                            "   If running locally for testing, set: export GITHUB_REPOSITORY_OWNER=<org>");
        }

        if (githubRepo == null || githubRepo.isEmpty()) {
            throw new IllegalArgumentException(
                    "❌ ERROR: GITHUB_REPOSITORY environment variable is required.\n" +
                            "   This value is trusted and provided by GitHub Actions.\n" +
                            "   Expected format: owner/repo\n" +
                            "   If running locally for testing, set: export GITHUB_REPOSITORY=<owner>/<repo>");
        }
    }

    /**
     * Cleans up orphaned tenant directories that are not registered in tenant-registry.json.
     *
     * Safety features:
     * - Only deletes UUID-formatted directories
     * - Skips if registry is empty, missing, or invalid
     * - Logs all actions before performing them
     */
    public static void cleanupOrphanedTenants(Path pagesRoot, TenantRegistry registry) {
        try {
            Path dataDir = pagesRoot.resolve("data");

            if (!Files.exists(dataDir) || !Files.isDirectory(dataDir)) {
                System.out.println("ℹ️  No data directory found, skipping orphan cleanup");
                return;
            }

            // Safety check: Registry must have at least one tenant
            if (registry.isEmpty()) {
                System.out.println("⚠️  WARNING: Tenant registry is empty - skipping orphan cleanup for safety");
                return;
            }

            List<String> registeredIds = registry.getRegisteredTenantIds();

            // Find all UUID directories in /data/
            List<String> foundIds = new ArrayList<>();
            try (var stream = Files.list(dataDir)) {
                stream.filter(Files::isDirectory)
                        .map(Path::getFileName)
                        .map(Path::toString)
                        .filter(name -> UUID_PATTERN.matcher(name).matches())
                        .forEach(foundIds::add);
            }

            if (foundIds.isEmpty()) {
                System.out.println("ℹ️  No tenant directories found in /data/, skipping cleanup");
                return;
            }

            // Find orphaned tenants (exist in filesystem but not in registry)
            List<String> orphanIds = new ArrayList<>();
            for (String foundId : foundIds) {
                if (!registeredIds.contains(foundId)) {
                    orphanIds.add(foundId);
                }
            }

            if (orphanIds.isEmpty()) {
                System.out.println("✅ No orphaned tenants found - all " + foundIds.size() + " tenant(s) are registered");
                return;
            }

            // Log what will be deleted
            System.out.println("🗑️  Found " + orphanIds.size() + " orphaned tenant(s) to clean up:");
            for (String orphanId : orphanIds) {
                System.out.println("   • " + orphanId);
            }
            System.out.println("   Registered tenants (will keep): " + registeredIds.size());
            System.out.println("   Total tenants before cleanup: " + foundIds.size());

            // Delete orphaned tenants
            int deleted = 0;
            for (String orphanId : orphanIds) {
                Path orphanPath = dataDir.resolve(orphanId);
                try {
                    deleteRecursively(orphanPath);
                    System.out.println("   ✅ Deleted: " + orphanId);
                    deleted++;
                } catch (IOException e) {
                    System.err.println("   ⚠️  Failed to delete " + orphanId + ": " + e.getMessage());
                }
            }

            System.out.println("✅ Cleaned up " + deleted + " orphaned tenant(s)");
            System.out.println("   Remaining tenants: " + (foundIds.size() - deleted));

        } catch (Exception e) {
            // Don't fail the entire job if cleanup fails
            System.err.println("⚠️  WARNING: Orphaned tenant cleanup failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Recursively deletes a directory and all its contents.
     */
    private static void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }

        if (Files.isDirectory(path)) {
            try (var stream = Files.walk(path)) {
                stream.sorted(Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                Files.delete(p);
                            } catch (IOException e) {
                                throw new RuntimeException("Failed to delete: " + p, e);
                            }
                        });
            }
        } else {
            Files.delete(path);
        }
    }
}
