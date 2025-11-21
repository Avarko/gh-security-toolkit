package fi.evolver.secops.githubPages;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Parses and validates builder configuration from JSON file.
 * Stateless utility class with static methods.
 */
public final class ConfigParser {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private ConfigParser() {
        // Utility class - no instantiation
    }

    /**
     * Configuration container parsed from JSON.
     */
    public static class Config {
        public Input input;
        public Metadata metadata;
    }

    /**
     * Input paths configuration.
     */
    public static class Input {
        public String outdir;
        public String pagesRoot;
        public String dashboardBuildDir;
    }

    /**
     * Scan metadata from GitHub Actions environment.
     */
    public static class Metadata {
        public String timestamp;
        public String channel;
        public String branch;
        public String repository;
        public String commitSha;
        public String scanId;
        public String ciJobName;
        public String ciJobUrl;
        public String actorName;
    }

    /**
     * Parses configuration from a JSON file.
     *
     * @param configFile Path to the configuration JSON file
     * @return Parsed configuration object
     * @throws IOException if file cannot be read
     * @throws IllegalArgumentException if file doesn't exist or is invalid
     */
    public static Config parse(String configFile) throws IOException {
        Path configPath = Path.of(configFile);
        if (!Files.exists(configPath)) {
            throw new IllegalArgumentException("Configuration file not found: " + configFile);
        }

        String configJson = Files.readString(configPath, StandardCharsets.UTF_8);
        Config config = GSON.fromJson(configJson, Config.class);

        validate(config);
        return config;
    }

    /**
     * Validates that required configuration fields are present.
     */
    private static void validate(Config config) {
        if (config == null) {
            throw new IllegalArgumentException("Configuration is null");
        }
        if (config.input == null) {
            throw new IllegalArgumentException("Configuration missing 'input' section");
        }
        if (config.metadata == null) {
            throw new IllegalArgumentException("Configuration missing 'metadata' section");
        }
        if (config.input.outdir == null || config.input.outdir.isEmpty()) {
            throw new IllegalArgumentException("Configuration missing 'input.outdir'");
        }
        if (config.metadata.channel == null || config.metadata.channel.isEmpty()) {
            throw new IllegalArgumentException("Configuration missing 'metadata.channel'");
        }
        if (config.metadata.timestamp == null || config.metadata.timestamp.isEmpty()) {
            throw new IllegalArgumentException("Configuration missing 'metadata.timestamp'");
        }
    }

    /**
     * Returns the shared Gson instance for JSON operations.
     */
    public static Gson getGson() {
        return GSON;
    }
}
