package fi.evolver.secops.githubPages.model;

/**
 * Statistics for a security scan (used in index pages).
 */
public class ScanStats {
    public VulnStats trivyFs = new VulnStats();
    public VulnStats trivyFsMisconfig = new VulnStats();
    public VulnStats trivyImage = new VulnStats();
    public VulnStats trivyImageMisconfig = new VulnStats();
    public int opengrepErrors = 0;
    public int opengrepWarnings = 0;
    public int opengrepInfo = 0;
    public boolean hasDependabot = false;

    public static class VulnStats {
        public int critical = 0;
        public int high = 0;
        public int medium = 0;
        public int low = 0;
        public boolean scanned = false;

        public int total() {
            return critical + high + medium + low;
        }

        public String getDisplay(String severityLevel) {
            if (!scanned) {
                return "✗";
            }
            int count = switch (severityLevel.toLowerCase()) {
                case "critical", "c" -> critical;
                case "high", "h" -> high;
                case "medium", "m" -> medium;
                case "low", "l" -> low;
                default -> 0;
            };
            return String.valueOf(count);
        }
    }
}
