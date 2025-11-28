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
 * Compares two scan results and reports changes in vulnerability counts.
 *
 * Usage: jbang compare_scans.java <scan-history.json> <channel> <current-timestamp>
 *
 * Output: JSON with comparison results
 *
 * Example:
 *   jbang compare_scans.java data/hist/scan-history.json push-to-main 20251127-103000
 */
public class compare_scans {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: compare_scans.java <scan-history.json> <channel> <current-timestamp>");
            System.exit(1);
        }

        String historyFile = args[0];
        String channel = args[1];
        String currentTimestamp = args[2];

        Path historyPath = Path.of(historyFile);
        if (!Files.exists(historyPath)) {
            System.err.println("Error: Scan history file not found: " + historyFile);
            System.exit(1);
        }

        // Load scan history
        String json = Files.readString(historyPath, StandardCharsets.UTF_8);
        TypeToken<Map<String, Object>> typeToken = new TypeToken<>() {};
        Map<String, Object> history = GSON.fromJson(json, typeToken.getType());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> scans = (List<Map<String, Object>>) history.get("scans");

        if (scans == null || scans.isEmpty()) {
            outputNoComparison("No scans found in history", channel, currentTimestamp);
            return;
        }

        // Filter scans for this channel and sort by timestamp
        List<Map<String, Object>> channelScans = scans.stream()
            .filter(scan -> channel.equals(scan.get("channel")))
            .sorted(Comparator.comparing(scan -> (String) scan.get("timestamp")))
            .collect(Collectors.toList());

        if (channelScans.isEmpty()) {
            outputNoComparison("No scans found for channel: " + channel, channel, currentTimestamp);
            return;
        }

        // Find current and previous scan
        Map<String, Object> currentScan = null;
        Map<String, Object> previousScan = null;

        for (int i = 0; i < channelScans.size(); i++) {
            Map<String, Object> scan = channelScans.get(i);
            if (currentTimestamp.equals(scan.get("timestamp"))) {
                currentScan = scan;
                if (i > 0) {
                    previousScan = channelScans.get(i - 1);
                }
                break;
            }
        }

        if (currentScan == null) {
            outputNoComparison("Current scan not found in history", channel, currentTimestamp);
            return;
        }

        if (previousScan == null) {
            outputNoComparison("First scan for this channel, no comparison available", channel, currentTimestamp);
            return;
        }

        // Compare scans
        ComparisonResult result = compareScans(currentScan, previousScan, channel);

        // Output JSON
        System.out.println(GSON.toJson(result));
    }

    private static void outputNoComparison(String reason, String channel, String currentTimestamp) {
        Map<String, Object> output = new HashMap<>();
        output.put("hasChanges", false);
        output.put("channel", channel);
        output.put("currentTimestamp", currentTimestamp);
        output.put("previousTimestamp", null);
        output.put("message", reason);
        System.out.println(GSON.toJson(output));
    }

    private static ComparisonResult compareScans(
            Map<String, Object> current,
            Map<String, Object> previous,
            String channel) {

        ComparisonResult result = new ComparisonResult();
        result.channel = channel;
        result.currentTimestamp = (String) current.get("timestamp");
        result.previousTimestamp = (String) previous.get("timestamp");
        result.changes = new HashMap<>();

        // Compare Trivy FS results
        Map<String, VulnChange> trivyFsChanges = compareTrivyResults(
            getNestedMap(current, "trivyFsResults", "totalVulnerabilities"),
            getNestedMap(previous, "trivyFsResults", "totalVulnerabilities")
        );

        // Compare Trivy Image results
        Map<String, VulnChange> trivyImageChanges = compareTrivyResults(
            getNestedMap(current, "trivyImageResults", "totalVulnerabilities"),
            getNestedMap(previous, "trivyImageResults", "totalVulnerabilities")
        );

        // Merge Trivy results
        Map<String, VulnChange> trivyChanges = mergeTrivyChanges(trivyFsChanges, trivyImageChanges);
        if (!trivyChanges.isEmpty()) {
            result.changes.put("trivy", trivyChanges);
        }

        // Compare Semgrep results
        Map<String, VulnChange> semgrepChanges = compareSemgrepResults(
            (Map<String, Object>) current.get("semgrepResults"),
            (Map<String, Object>) previous.get("semgrepResults")
        );
        if (!semgrepChanges.isEmpty()) {
            result.changes.put("semgrep", semgrepChanges);
        }

        // Generate summary
        result.hasChanges = !result.changes.isEmpty();
        result.summary = generateSummary(result.changes);

        // Extract metadata
        result.metadata = extractMetadata(current);

        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> getNestedMap(Map<String, Object> map, String... keys) {
        Map<String, Object> current = map;
        for (String key : keys) {
            if (current == null) return new HashMap<>();
            Object value = current.get(key);
            if (value instanceof Map) {
                current = (Map<String, Object>) value;
            } else {
                return new HashMap<>();
            }
        }
        return current != null ? current : new HashMap<>();
    }

    private static Map<String, VulnChange> compareTrivyResults(
            Map<String, Object> current,
            Map<String, Object> previous) {

        Map<String, VulnChange> changes = new HashMap<>();

        Set<String> allSeverities = new HashSet<>();
        allSeverities.addAll(current.keySet());
        allSeverities.addAll(previous.keySet());

        for (String severity : allSeverities) {
            int currentCount = getCount(current.get(severity));
            int previousCount = getCount(previous.get(severity));

            if (currentCount != previousCount) {
                VulnChange change = new VulnChange();
                change.previous = previousCount;
                change.current = currentCount;
                change.delta = currentCount - previousCount;
                change.status = currentCount > previousCount ? "increased" : "decreased";
                changes.put(severity.toLowerCase(), change);
            }
        }

        return changes;
    }

    private static Map<String, VulnChange> mergeTrivyChanges(
            Map<String, VulnChange> fsChanges,
            Map<String, VulnChange> imageChanges) {

        Map<String, VulnChange> merged = new HashMap<>(fsChanges);

        for (Map.Entry<String, VulnChange> entry : imageChanges.entrySet()) {
            String severity = entry.getKey();
            VulnChange imageChange = entry.getValue();

            if (merged.containsKey(severity)) {
                VulnChange fsChange = merged.get(severity);
                VulnChange combined = new VulnChange();
                combined.previous = fsChange.previous + imageChange.previous;
                combined.current = fsChange.current + imageChange.current;
                combined.delta = combined.current - combined.previous;
                combined.status = combined.delta > 0 ? "increased" : (combined.delta < 0 ? "decreased" : "unchanged");
                merged.put(severity, combined);
            } else {
                merged.put(severity, imageChange);
            }
        }

        return merged;
    }

    private static Map<String, VulnChange> compareSemgrepResults(
            Map<String, Object> current,
            Map<String, Object> previous) {

        Map<String, VulnChange> changes = new HashMap<>();

        if (current == null) current = new HashMap<>();
        if (previous == null) previous = new HashMap<>();

        String[] fields = {"totalErrors", "totalWarnings", "totalInfos"};
        String[] keys = {"errors", "warnings", "infos"};

        for (int i = 0; i < fields.length; i++) {
            int currentCount = getCount(current.get(fields[i]));
            int previousCount = getCount(previous.get(fields[i]));

            if (currentCount != previousCount) {
                VulnChange change = new VulnChange();
                change.previous = previousCount;
                change.current = currentCount;
                change.delta = currentCount - previousCount;
                change.status = currentCount > previousCount ? "increased" : "decreased";
                changes.put(keys[i], change);
            }
        }

        return changes;
    }

    private static int getCount(Object value) {
        if (value == null) return 0;
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return 0;
    }

    private static String generateSummary(Map<String, Map<String, VulnChange>> changes) {
        List<String> parts = new ArrayList<>();

        // Trivy changes
        Map<String, VulnChange> trivyChanges = changes.get("trivy");
        if (trivyChanges != null) {
            if (trivyChanges.containsKey("critical")) {
                VulnChange c = trivyChanges.get("critical");
                String icon = c.delta > 0 ? "🔴" : "✅";
                parts.add(String.format("%s %d CRITICAL (%+d)", icon, c.current, c.delta));
            }
            if (trivyChanges.containsKey("high")) {
                VulnChange c = trivyChanges.get("high");
                String icon = c.delta > 0 ? "🟠" : "✅";
                parts.add(String.format("%s %d HIGH (%+d)", icon, c.current, c.delta));
            }
        }

        // Semgrep changes
        Map<String, VulnChange> semgrepChanges = changes.get("semgrep");
        if (semgrepChanges != null) {
            if (semgrepChanges.containsKey("errors")) {
                VulnChange c = semgrepChanges.get("errors");
                String icon = c.delta > 0 ? "❌" : "✅";
                parts.add(String.format("%s %d Semgrep errors (%+d)", icon, c.current, c.delta));
            }
        }

        if (parts.isEmpty()) {
            return "No significant changes";
        }

        return String.join(", ", parts);
    }

    @SuppressWarnings("unchecked")
    private static ScanMetadata extractMetadata(Map<String, Object> scan) {
        ScanMetadata meta = new ScanMetadata();
        Map<String, Object> metadataMap = (Map<String, Object>) scan.get("metadata");
        if (metadataMap != null) {
            meta.branch = (String) metadataMap.get("branch");
            meta.commit = (String) metadataMap.get("commit");
            meta.repository = (String) metadataMap.get("repository");
        }
        return meta;
    }

    static class ComparisonResult {
        String channel;
        String currentTimestamp;
        String previousTimestamp;
        Map<String, Map<String, VulnChange>> changes;
        boolean hasChanges;
        String summary;
        ScanMetadata metadata;
    }

    static class VulnChange {
        int previous;
        int current;
        int delta;
        String status; // "increased", "decreased", "unchanged"
    }

    static class ScanMetadata {
        String branch;
        String commit;
        String repository;
    }
}
