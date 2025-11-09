///usr/bin/env jbang "$0" "$@" ; exit $?
/*
 * Slack Integration for sending notifications via Slack API
 *
 * Usage:
 *   jbang scripts/slack_integration.java <title> <message>
 *
 * Env:
 *   SLACK_BOT_TOKEN (required) - OAuth token with chat:write permission
 *   SLACK_CHANNEL (required) - Channel ID (#security-alerts), User ID (U1234567890), or email
 */
//DEPS com.fasterxml.jackson.core:jackson-databind:2.17.2
//DEPS com.squareup.okhttp3:okhttp:4.12.0

import com.fasterxml.jackson.databind.*;
import okhttp3.*;

import java.io.*;

public class slack_integration {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: jbang slack_integration.java <title> <message>");
            System.err.println("Env: SLACK_BOT_TOKEN, SLACK_CHANNEL");
            System.exit(1);
        }

        String title = args[0];
        String message = args[1];

        String token = System.getenv("SLACK_BOT_TOKEN");
        String channel = System.getenv("SLACK_CHANNEL");

        if (token == null || token.isBlank()) {
            System.err.println("Error: SLACK_BOT_TOKEN environment variable is required");
            System.exit(1);
        }

        if (channel == null || channel.isBlank()) {
            System.err.println("Error: SLACK_CHANNEL environment variable is required");
            System.exit(1);
        }

        boolean success = sendSlackNotification(token, channel, title, message);
        System.exit(success ? 0 : 1);
    }

    public static boolean sendSlackNotification(String token, String channel, String title, String text) {
        try {
            OkHttpClient client = new OkHttpClient();

            // If channel looks like email, resolve to User ID first
            String targetChannel = channel;
            if (channel.contains("@")) {
                targetChannel = resolveUserByEmail(client, token, channel);
                if (targetChannel == null) {
                    System.err.println("Failed to resolve Slack user from email: " + channel);
                    return false;
                }
                System.out.println("Resolved email " + channel + " to user ID: " + targetChannel);
            }

            // Build Block Kit JSON payload - parse title and text as JSON-like structure
            // Title format: "*🔍 Trivy security scan*\n*repo | branch | sha @ timestamp*"
            // Text format: JSON string with blocks data
            String payload = buildBlockKitPayload(targetChannel, title, text);

            Request req = new Request.Builder()
                    .url("https://slack.com/api/chat.postMessage")
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .post(RequestBody.create(payload, MediaType.parse("application/json")))
                    .build();

            try (Response resp = client.newCall(req).execute()) {
                String body = resp.body() != null ? resp.body().string() : "";
                if (resp.isSuccessful()) {
                    System.out.println("Slack notification sent to " + targetChannel + ": " + resp.code());
                    return true;
                } else {
                    System.err.println("Slack API error: " + resp.code() + " - " + body);
                    return false;
                }
            }
        } catch (Exception e) {
            System.err.println("Slack notify failed: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    static String buildBlockKitPayload(String channel, String title, String text) {
        // Parse title: line 1 = header, line 2 = metadata
        String[] titleLines = title.split("\n", 2);
        String headerText = titleLines[0].replace("*", "").trim();
        String metadata = titleLines.length > 1 ? titleLines[1].replace("*", "").trim() : "";

        // Parse text to extract counts and vulnerabilities
        String[] sections = text.split("\n\n", 2);
        String counts = sections.length > 0 ? sections[0].trim() : "";
        String vulnList = sections.length > 1 ? sections[1] : "";

        // Remove "Top 5 vulnerabilities:" header if present
        if (vulnList.startsWith("Top 5 vulnerabilities:")) {
            vulnList = vulnList.substring("Top 5 vulnerabilities:".length()).trim();
        }

        StringBuilder payload = new StringBuilder();
        payload.append("{")
                .append("\"channel\":").append(quote(channel)).append(",")
                .append("\"text\":").append(quote(headerText)).append(",")
                .append("\"blocks\":[")
                // Header
                .append("{\"type\":\"header\",\"text\":{\"type\":\"plain_text\",\"text\":")
                .append(quote(headerText)).append(",\"emoji\":true}},")
                // Metadata
                .append("{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":")
                .append(quote(formatMetadataWithMarkdown(metadata))).append("}},")
                // Severity summary
                .append("{\"type\":\"context\",\"elements\":[{\"type\":\"mrkdwn\",\"text\":")
                .append(quote(formatSeveritySummary(counts))).append("}]},")
                .append("{\"type\":\"divider\"},")
                // Vulnerabilities (HUOM: käytä oikeaa \n, EI \\n)
                .append("{\"type\":\"section\",\"text\":{\"type\":\"mrkdwn\",\"text\":")
                .append(quote("*Top 5 vulnerabilities:*\n" + formatVulnerabilitiesWithEmojis(vulnList)))
                .append("}}]")
                .append("}");

        return payload.toString();
    }

    static String formatMetadataWithMarkdown(String metadata) {
        String[] parts = metadata.split("\\|");
        if (parts.length >= 3) {
            String repo = parts[0].trim();
            String branch = parts[1].trim();
            String shaAndTime = parts[2].trim();
            String[] st = shaAndTime.split("@", 2);
            String sha = st[0].trim();
            String timestamp = st.length > 1 ? st[1].trim() : "";
            return "*" + repo + "* | `" + branch + "` | `" + sha + "` | " + timestamp;
        }
        return metadata;
    }

    static String extractCveId(String s) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(CVE-\\d{4}-\\d{4,7})")
                .matcher(s);
        return m.find() ? m.group(1) : null;
    }

    static String cveLinks(String cveId) {
        // HUOM: älä koske cveId:hen (ei boldausta tms.) URL:eja rakentaessa
        String cve = "<https://www.cve.org/CVERecord?id=" + cveId + "|CVE.org>";
        String nvd = "<https://nvd.nist.gov/vuln/detail/" + cveId + "|NIST>";
        String osv = "<https://osv.dev/vulnerability/" + cveId + "|OSV>";
        return cve + ", " + nvd + ", " + osv;
    }

    static String formatSeveritySummary(String counts) {
        // Input: "CRITICAL:1, HIGH:16, MEDIUM:49, LOW:101"
        // Output: "*Severity summary:* :red_circle: CRITICAL: *1* :large_orange_circle:
        // HIGH: *16* ..."
        StringBuilder result = new StringBuilder("*Severity summary:* ");
        String[] parts = counts.split(",");
        for (String part : parts) {
            part = part.trim();
            if (part.startsWith("CRITICAL:")) {
                result.append(":red_circle: CRITICAL: *").append(part.substring(9)).append("* ");
            } else if (part.startsWith("HIGH:")) {
                result.append(":large_orange_circle: HIGH: *").append(part.substring(5)).append("* ");
            } else if (part.startsWith("MEDIUM:")) {
                result.append(":yellow_circle: MEDIUM: *").append(part.substring(7)).append("* ");
            } else if (part.startsWith("LOW:")) {
                result.append(":green_circle: LOW: *").append(part.substring(4)).append("* ");
            }
        }
        return result.toString().trim();
    }

    static String formatVulnerabilitiesWithEmojis(String vulnList) {
        StringBuilder out = new StringBuilder();
        String[] lines = vulnList.split("\n");

        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty())
                continue;

            // Rivi joka alkaa "• [SEVERITY]"
            if (line.startsWith("• [")) {
                String emoji = "";
                String severity = "";
                if (line.contains("[CRITICAL]")) {
                    emoji = ":red_circle:";
                    severity = "CRITICAL";
                } else if (line.contains("[HIGH]")) {
                    emoji = ":large_orange_circle:";
                    severity = "HIGH";
                } else if (line.contains("[MEDIUM]")) {
                    emoji = ":yellow_circle:";
                    severity = "MEDIUM";
                } else if (line.contains("[LOW]")) {
                    emoji = ":green_circle:";
                    severity = "LOW";
                }

                // Poimi CVE-ID
                String cveId = extractCveId(line);

                // 1) Poista prefixi ja tee boldaus ensiksi (ei sotke linkkien URL:eja)
                String content = line.replaceFirst("• \\[" + severity + "\\]\\s*", "");
                if (cveId != null) {
                    // korvaa vain "paljaat" esiintymät, ei URL:eja (koska linkkejä ei vielä ole)
                    content = content.replace(cveId, "*" + cveId + "*");
                }

                // 2) Lisää klikattavat linkit vasta boldauksen jälkeen
                if (cveId != null) {
                    content = content
                            .replace("(CVE.org, NIST, OSV)", "(" + cveLinks(cveId) + ")")
                            .replace("CVE.org, NIST, OSV", cveLinks(cveId));
                }

                out.append("• ").append(emoji).append(" *").append(severity).append("* ")
                        .append(content).append("\n");
                continue;
            }

            // Rivi jossa paketti ja “→ fix:”
            if (line.contains("→")) {
                int arrow = line.indexOf("→");
                String pkg = line.substring(0, arrow).trim();
                String fix = line.substring(arrow + 1).trim(); // esim. "fix: 1.2.3, 4.5.6" tai "fix: -"

                String pkgFmt = "`" + pkg + "`";

                String fixFmt;
                if (fix.matches("(?i)^fix:\\s*-\\s*$")) {
                    fixFmt = "fix: _no known fix_";
                } else {
                    String rest = fix.replaceFirst("(?i)^fix:\\s*", "");
                    String[] parts = rest.split(",");
                    StringBuilder fb = new StringBuilder("fix: ");
                    for (int i = 0; i < parts.length; i++) {
                        String p = parts[i].trim();
                        if (!p.isEmpty()) {
                            if (i > 0)
                                fb.append(", ");
                            fb.append("`").append(p).append("`");
                        }
                    }
                    fixFmt = fb.toString();
                }

                out.append("  ").append(pkgFmt).append(" \u2192 ").append(fixFmt).append("\n");
                continue;
            }

            out.append(line).append("\n");
        }

        return out.toString().trim();
    }

    static String resolveUserByEmail(OkHttpClient client, String token, String email) throws IOException {
        Request req = new Request.Builder()
                .url("https://slack.com/api/users.lookupByEmail?email=" + email)
                .header("Authorization", "Bearer " + token)
                .get()
                .build();

        try (Response resp = client.newCall(req).execute()) {
            if (!resp.isSuccessful()) {
                return null;
            }
            String body = resp.body() != null ? resp.body().string() : "";
            // Simple JSON parsing - extract "user":{"id":"U1234..."}
            int userIdStart = body.indexOf("\"id\":\"");
            if (userIdStart > 0) {
                userIdStart += 6;
                int userIdEnd = body.indexOf("\"", userIdStart);
                return body.substring(userIdStart, userIdEnd);
            }
        }
        return null;
    }

    static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
