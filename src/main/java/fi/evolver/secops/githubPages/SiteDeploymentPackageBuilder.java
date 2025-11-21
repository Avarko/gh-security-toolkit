package fi.evolver.secops.githubPages;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Builds the final GitHub Pages site by merging dashboard assets.
 * Stateless utility class with static methods.
 */
public final class SiteDeploymentPackageBuilder {

    private SiteDeploymentPackageBuilder() {
        // Utility class - no instantiation
    }

    /**
     * Merges dashboard build artifacts into the pages root.
     * Copies all files from dashboardDir to pagesRoot, preserving directory structure.
     *
     * @param pagesRoot Root directory for GitHub Pages
     * @param dashboardDir Directory containing built dashboard assets
     * @throws IOException if file operations fail
     */
    public static void mergeDashboard(Path pagesRoot, Path dashboardDir) throws IOException {
        System.out.println("🎨 Merging dashboard from: " + dashboardDir);

        if (!Files.exists(dashboardDir)) {
            System.err.println("⚠️  Dashboard directory not found: " + dashboardDir);
            return;
        }

        Files.walk(dashboardDir)
                .filter(Files::isRegularFile)
                .forEach(source -> {
                    try {
                        Path relative = dashboardDir.relativize(source);
                        Path target = pagesRoot.resolve(relative);
                        Files.createDirectories(target.getParent());
                        Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to copy dashboard file: " + source, e);
                    }
                });

        System.out.println("   ✅ Dashboard merged successfully");
    }
}
