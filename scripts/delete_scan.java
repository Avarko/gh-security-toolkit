///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Deletes scans from scan history and removes their data directories.
 * Supports multiple deletion modes: single, list, range, all.
 *
 * Usage: jbang delete_scan.java <channel> <timestamps> <mode>
 *
 * Examples:
 *   jbang delete_scan.java push-to-main "20251122-105346" single
 *   jbang delete_scan.java push-to-main "20251122-105346,20251123-143022" list
 *   jbang delete_scan.java push-to-main "20251122-105346..20251124-091532" range
 *   jbang delete_scan.java push-to-main "*" all
 */
public class delete_scan {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: delete_scan.java <channel> <timestamps> <mode>");
            System.exit(1);
        }

        String channel = args[0];
        String timestampsInput = args[1];
        String mode = args[2];

        System.out.println("🗑️  Delete Scan Operation");
        System.out.println("   Channel: " + channel);
        System.out.println("   Timestamps: " + timestampsInput);
        System.out.println("   Mode: " + mode);
        System.out.println();

        // Parse timestamps to delete based on mode
        Set<String> timestampsToDelete = parseTimestamps(channel, timestampsInput, mode);

        if (timestampsToDelete.isEmpty()) {
            System.out.println("⚠️  No matching scans found to delete");
            System.exit(0);
        }

        System.out.println("📋 Scans to delete: " + timestampsToDelete.size());
        timestampsToDelete.forEach(ts -> System.out.println("   - " + ts));
        System.out.println();

        // Delete from scan-history.json
        int deletedFromHistory = deleteScanFromHistory(channel, timestampsToDelete);

        // Delete data directories
        int deletedDirs = deleteDataDirectories(channel, timestampsToDelete);

        System.out.println();
        System.out.println("✅ Deletion complete!");
        System.out.println("   Removed from history: " + deletedFromHistory);
        System.out.println("   Deleted directories: " + deletedDirs);
    }

    /**
     * Parse timestamp input based on mode.
     * For "all" and "range" modes, efficiently load existing timestamps from history.
     */
    private static Set<String> parseTimestamps(String channel, String input, String mode)
            throws IOException {
        Set<String> result = new HashSet<>();

        switch (mode) {
            case "single":
                result.add(input);
                break;

            case "list":
                String[] parts = input.split(",");
                for (String ts : parts) {
                    result.add(ts.trim());
                }
                break;

            case "range":
                // Parse range: "20251122-105346..20251124-091532"
                String[] bounds = input.split("\\.\\.");
                if (bounds.length != 2) {
                    System.err.println("Invalid range format: " + input);
                    System.exit(1);
                }
                String rangeStart = bounds[0].trim();
                String rangeEnd = bounds[1].trim();

                // Efficiently get all timestamps in range from history
                result.addAll(getTimestampsInRange(channel, rangeStart, rangeEnd));
                break;

            case "all":
                // Get all timestamps for channel from history
                result.addAll(getAllTimestampsForChannel(channel));
                break;

            default:
                System.err.println("Unknown deletion mode: " + mode);
                System.exit(1);
        }

        return result;
    }

    /**
     * Get all timestamps for a channel from scan-history.json.
     * O(n) where n = total scans in history.
     */
    private static Set<String> getAllTimestampsForChannel(String channel) throws IOException {
        List<Map<String, Object>> scans = loadScansFromHistory();

        return scans.stream()
            .filter(scan -> channel.equals(scan.get("channel")))
            .map(scan -> (String) scan.get("timestamp"))
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    }

    /**
     * Get timestamps in range [start, end] for a channel from scan-history.json.
     * O(n) where n = total scans in history.
     * Timestamps are lexicographically comparable (YYYYMMDD-HHMMSS format).
     */
    private static Set<String> getTimestampsInRange(String channel, String start, String end)
            throws IOException {
        List<Map<String, Object>> scans = loadScansFromHistory();

        return scans.stream()
            .filter(scan -> channel.equals(scan.get("channel")))
            .map(scan -> (String) scan.get("timestamp"))
            .filter(Objects::nonNull)
            .filter(ts -> ts.compareTo(start) >= 0 && ts.compareTo(end) <= 0)
            .collect(Collectors.toSet());
    }

    /**
     * Load scans array from scan-history.json.
     */
    private static List<Map<String, Object>> loadScansFromHistory() throws IOException {
        Path historyPath = Path.of("data/hist/scan-history.json");

        if (!Files.exists(historyPath)) {
            System.err.println("⚠️  scan-history.json not found at: " + historyPath);
            return Collections.emptyList();
        }

        String json = Files.readString(historyPath, StandardCharsets.UTF_8);
        TypeToken<Map<String, Object>> typeToken = new TypeToken<>() {};
        Map<String, Object> history = GSON.fromJson(json, typeToken.getType());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> scans = (List<Map<String, Object>>) history.get("scans");

        return scans != null ? scans : Collections.emptyList();
    }

    /**
     * Delete scans from scan-history.json.
     * O(n) where n = total scans in history.
     */
    private static int deleteScanFromHistory(String channel, Set<String> timestampsToDelete)
            throws IOException {
        Path historyPath = Path.of("data/hist/scan-history.json");

        if (!Files.exists(historyPath)) {
            System.out.println("⚠️  scan-history.json not found, skipping history update");
            return 0;
        }

        // Read history
        String json = Files.readString(historyPath, StandardCharsets.UTF_8);
        TypeToken<Map<String, Object>> typeToken = new TypeToken<>() {};
        Map<String, Object> history = GSON.fromJson(json, typeToken.getType());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> scans = (List<Map<String, Object>>) history.get("scans");

        if (scans == null || scans.isEmpty()) {
            System.out.println("⚠️  No scans found in history");
            return 0;
        }

        int originalSize = scans.size();

        // Filter out scans to delete
        List<Map<String, Object>> filtered = scans.stream()
            .filter(scan -> {
                String scanChannel = (String) scan.get("channel");
                String scanTimestamp = (String) scan.get("timestamp");

                if (channel.equals(scanChannel) && timestampsToDelete.contains(scanTimestamp)) {
                    System.out.println("   ✅ Removing from history: " + scanTimestamp);
                    return false; // Remove this scan
                }
                return true; // Keep this scan
            })
            .collect(Collectors.toList());

        int newSize = filtered.size();
        int removed = originalSize - newSize;

        if (removed == 0) {
            System.out.println("⚠️  No matching scans found in history");
            return 0;
        }

        history.put("scans", filtered);

        // Write updated history
        Files.writeString(historyPath, GSON.toJson(history), StandardCharsets.UTF_8);

        System.out.println("✅ Updated scan-history.json");
        System.out.println("   Before: " + originalSize + " scans");
        System.out.println("   After: " + newSize + " scans");

        return removed;
    }

    /**
     * Delete data directories for specified scans.
     * O(m) where m = number of scans to delete.
     */
    private static int deleteDataDirectories(String channel, Set<String> timestampsToDelete)
            throws IOException {
        int deleted = 0;

        for (String timestamp : timestampsToDelete) {
            Path runPath = Path.of("data/runs", channel, timestamp);

            if (!Files.exists(runPath)) {
                System.out.println("   ⚠️  Directory not found (already deleted?): " + runPath);
                continue;
            }

            // Recursively delete directory
            Files.walk(runPath)
                .sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    try {
                        Files.delete(path);
                    } catch (IOException e) {
                        System.err.println("   ⚠️  Failed to delete: " + path + " - " + e.getMessage());
                    }
                });

            System.out.println("   ✅ Deleted directory: " + runPath);
            deleted++;
        }

        // Check if channel directory is empty and delete it
        Path channelPath = Path.of("data/runs", channel);
        if (Files.exists(channelPath) && isDirectoryEmpty(channelPath)) {
            Files.delete(channelPath);
            System.out.println("   ✅ Deleted empty channel directory: " + channelPath);
        }

        return deleted;
    }

    private static boolean isDirectoryEmpty(Path directory) throws IOException {
        try (var stream = Files.list(directory)) {
            return stream.findAny().isEmpty();
        }
    }
}
