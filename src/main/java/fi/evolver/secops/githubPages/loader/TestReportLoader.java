package fi.evolver.secops.githubPages.loader;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Loads test report metadata from scan-context.json.
 *
 * Test reports (JaCoCo, Surefire) are uploaded as artifacts with a scan-context.json
 * that contains metadata about the source (branch, commit, repository, etc.).
 */
public class TestReportLoader {
    private final Gson gson;

    public TestReportLoader(Gson gson) {
        this.gson = gson;
    }

    /**
     * Loads test report context from a directory containing scan-context.json.
     *
     * @param reportDir Directory containing test reports and scan-context.json
     * @return TestReportContext with metadata, or empty context if file not found
     */
    public TestReportContext load(Path reportDir) {
        TestReportContext context = new TestReportContext();

        Path contextFile = reportDir.resolve("scan-context.json");
        if (!Files.exists(contextFile)) {
            System.out.println("ℹ️  No scan-context.json found in test reports");
            return context;
        }

        try {
            String json = Files.readString(contextFile);
            if (json == null || json.isBlank()) {
                return context;
            }

            JsonObject obj = gson.fromJson(json, JsonObject.class);
            if (obj == null) {
                return context;
            }

            context.channel = getString(obj, "channel");
            context.timestamp = getString(obj, "timestamp");
            context.branch = getString(obj, "branch");
            context.repository = getString(obj, "repository");
            context.commitSha = getString(obj, "commitSha");
            context.scanId = getString(obj, "scanId");
            context.ciJobName = getString(obj, "ciJobName");
            context.ciJobUrl = getString(obj, "ciJobUrl");
            context.actorName = getString(obj, "actorName");

            // Check for coverage and tests directories
            context.hasJacoco = Files.isDirectory(reportDir.resolve("coverage"));
            context.hasSurefire = Files.isDirectory(reportDir.resolve("tests"));

            System.out.println("📋 Loaded test report context:");
            System.out.println("   Channel: " + context.channel);
            System.out.println("   Branch: " + context.branch);
            System.out.println("   Repository: " + context.repository);
            System.out.println("   Commit: " + (context.commitSha != null ? context.commitSha.substring(0, Math.min(7, context.commitSha.length())) : "N/A"));
            System.out.println("   JaCoCo: " + context.hasJacoco);
            System.out.println("   Surefire: " + context.hasSurefire);

            return context;
        } catch (IOException e) {
            System.err.println("⚠️  Failed to read test report context: " + e.getMessage());
            return context;
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse test report context: " + e.getMessage());
            return context;
        }
    }

    private String getString(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return null;
        }
        String value = obj.get(key).getAsString();
        return (value != null && !value.isBlank()) ? value : null;
    }

    /**
     * Container for test report context data.
     */
    public static class TestReportContext {
        // Metadata from scan-context.json
        public String channel;
        public String timestamp;
        public String branch;
        public String repository;
        public String commitSha;
        public String scanId;
        public String ciJobName;
        public String ciJobUrl;
        public String actorName;

        // Report availability
        public boolean hasJacoco;
        public boolean hasSurefire;

        /**
         * Returns true if this context has valid metadata.
         */
        public boolean hasMetadata() {
            return channel != null && !channel.isBlank();
        }

        /**
         * Returns true if any test reports are available.
         */
        public boolean hasReports() {
            return hasJacoco || hasSurefire;
        }
    }
}
