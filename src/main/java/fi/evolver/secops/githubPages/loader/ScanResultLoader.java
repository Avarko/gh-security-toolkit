package fi.evolver.secops.githubPages.loader;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Loads raw scan results from JSON files.
 * This layer reads files and parses JSON, but doesn't interpret structure.
 */
public class ScanResultLoader {
    private final Gson gson;

    public ScanResultLoader(Gson gson) {
        this.gson = gson;
    }

    public RawScanData load(String outputDir, String metadataJsonPath) {
        Path outPath = Path.of(outputDir);
        RawScanData data = new RawScanData();

        // Load metadata
        if (metadataJsonPath != null && Files.exists(Path.of(metadataJsonPath))) {
            data.metadata = loadJson(Path.of(metadataJsonPath));
        }

        // Load Trivy results
        data.trivyFs = loadJson(outPath.resolve("trivy-fs-results.json"));
        data.trivyImage = loadJson(outPath.resolve("trivy-image-results.json"));

        // Load Opengrep results
        data.opengrep = loadJson(outPath.resolve("opengrep-results.json"));

        // Load summary markdowns
        data.trivySummary = loadText(outPath.resolve("TRIVY_SUMMARY.md"));
        data.opengrepSummary = loadText(outPath.resolve("SEMGREP_SUMMARY.md"));
        data.dependabotSummary = loadText(outPath.resolve("DEPENDABOT_SUMMARY.md"));

        return data;
    }

    private JsonObject loadJson(Path path) {
        if (!Files.exists(path)) {
            return null;
        }
        try {
            String content = Files.readString(path);
            if (content.isBlank()) {
                return null;
            }
            return gson.fromJson(content, JsonObject.class);
        } catch (IOException e) {
            System.err.println("⚠️  Failed to load JSON from " + path + ": " + e.getMessage());
            return null;
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse JSON from " + path + ": " + e.getMessage());
            return null;
        }
    }

    private String loadText(Path path) {
        if (!Files.exists(path)) {
            return null;
        }
        try {
            if (Files.size(path) == 0) {
                return null;
            }
            return Files.readString(path);
        } catch (IOException e) {
            System.err.println("⚠️  Failed to load text from " + path + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Container for raw loaded data (before transformation).
     */
    public static class RawScanData {
        public JsonObject metadata;
        public JsonObject trivyFs;
        public JsonObject trivyImage;
        public JsonObject opengrep;
        public String trivySummary;
        public String opengrepSummary;
        public String dependabotSummary;
    }
}
