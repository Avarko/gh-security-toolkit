package fi.evolver.secops.githubPages.renderer;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import freemarker.core.HTMLOutputFormat;
import freemarker.ext.beans.BeansWrapperBuilder;
import freemarker.template.*;

import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.stream.Stream;

/**
 * Renders FreeMarker templates to HTML and writes artifacts.
 */
public class PageRenderer {
    private final Configuration cfg;
    private final Gson gson;

    public PageRenderer(Path templateDir, Gson gson) throws IOException {
        this.cfg = createFreeMarkerConfig(templateDir);
        this.gson = gson;
    }

    private Configuration createFreeMarkerConfig(Path templateDir) throws IOException {
        Configuration cfg = new Configuration(Configuration.VERSION_2_3_33);
        cfg.setDirectoryForTemplateLoading(templateDir.toFile());
        cfg.setDefaultEncoding("UTF-8");

        // Enable HTML auto-escaping for security
        cfg.setOutputFormat(HTMLOutputFormat.INSTANCE);
        cfg.setAutoEscapingPolicy(Configuration.ENABLE_IF_SUPPORTED_AUTO_ESCAPING_POLICY);
        cfg.setRecognizeStandardFileExtensions(true);

        cfg.setLogTemplateExceptions(false);
        cfg.setWrapUncheckedExceptions(true);
        cfg.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);

        // Allow access to public fields and methods
        var owb = new BeansWrapperBuilder(Configuration.VERSION_2_3_33);
        owb.setExposeFields(true);
        owb.setSimpleMapWrapper(true);
        cfg.setObjectWrapper(owb.build());

        return cfg;
    }

    public void renderPage(String templateName, Map<String, Object> model, Path outputPath)
            throws IOException, TemplateException {
        Files.createDirectories(outputPath.getParent());
        Template tpl = cfg.getTemplate(templateName);
        try (Writer w = Files.newBufferedWriter(outputPath, StandardCharsets.UTF_8)) {
            tpl.process(model, w);
        }
    }

    public void copyJsonFiles(String outputDir, Path scanPath) throws IOException {
        Path outPath = Path.of(outputDir);
        if (!Files.exists(outPath)) {
            System.err.println("⚠️  Output directory does not exist: " + outPath);
            return;
        }
        try (Stream<Path> s = Files.list(outPath)) {
            s.filter(p -> p.toString().endsWith(".json")).forEach(src -> {
                try {
                    Files.copy(src, scanPath.resolve(src.getFileName()), StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException e) {
                    System.err.println("⚠️  Failed to copy " + src.getFileName() + ": " + e.getMessage());
                }
            });
        }
    }

    /**
     * Write scan-metadata.json to scan directory (deterministic artifact).
     */
    public void writeMetadataJson(Path scanPath, String branch, String commitSha, String repository)
            throws IOException {
        JsonObject meta = new JsonObject();
        if (branch != null)
            meta.addProperty("branch", branch);
        if (commitSha != null)
            meta.addProperty("commit_sha", commitSha);
        if (repository != null)
            meta.addProperty("repository", repository);

        Files.writeString(
                scanPath.resolve("scan-metadata.json"),
                gson.toJson(meta),
                StandardCharsets.UTF_8);
    }

    public void writeCss(Path pagesPath) throws IOException {
        String css = """
                /* GitHub Pages Security Scan - Unified CSS */
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif; line-height:1.6; color:#333; background:#f5f5f5; }
                header { background:#2c3e50; color:#fff; padding:2rem; text-align:center; }
                header h1{ margin-bottom:.5rem; }
                header .subtitle{ color:#ecf0f1; font-size:1.1rem; }
                nav{ margin-top:1rem; }
                nav a{ color:#3498db; text-decoration:none; margin:0 1rem; }
                nav a:hover{ text-decoration:underline; }
                main{ max-width:1200px; margin:2rem auto; padding:0 1rem; }
                section{ background:#fff; padding:2rem; margin-bottom:2rem; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,.1); }
                section h2{ color:#2c3e50; margin-bottom:1rem; padding-bottom:.5rem; border-bottom:2px solid #3498db; }
                .metadata dl{ display:grid; grid-template-columns:150px 1fr; gap:.5rem; }
                .metadata dt{ font-weight:bold; color:#7f8c8d; }
                .metadata dd{ color:#2c3e50; }

                /* Table wrapper with scroll */
                .table-wrapper{ overflow-x:auto; overflow-y:auto; max-height:600px; margin:1rem 0; }

                /* Main scan tables */
                .scan-table{ width:100%; border-collapse:collapse; font-size:.9rem; }
                .scan-table th{ background:#54697e; color:#fff; padding:.75rem .5rem; text-align:center; font-weight:600; border:1px solid #2c3e50; font-size:.85rem; position:sticky; top:0; z-index:10; }
                .scan-table td{ padding:.75rem .5rem; text-align:center; border:1px solid #ddd; }
                .scan-table tbody tr:hover{ background:#f8f9fa; }
                .timestamp-cell{text-align:left !important; white-space:nowrap; }
                .timestamp-cell a{ color:#3498db; text-decoration:none; font-weight:500; }

                /* Severity colors (full names for findings) */
                .severity-critical{ color:#c0392b; font-weight:bold; }
                .severity-high{ color:#e67e22; font-weight:bold; }
                .severity-medium{ color:#f39c12; }
                .severity-low{ color:#95a5a6; }
                .severity-error{ color:#c0392b; font-weight:bold; }
                .severity-warn{ color:#f39c12; }
                .severity-info{ color:#3498db; }

                /* Severity legend short codes (for headers in index tables) */
                .severity-c{ color:#c0392b; font-weight:bold; }
                .severity-h{ color:#e67e22; font-weight:bold; }
                .severity-m{ color:#f39c12; }
                .severity-l{ color:#95a5a6; }

                /* Findings tables */
                .findings-table{ margin:1.5rem 0; }
                .findings-table th{ background:#34495e; }
                .target-cell,.path-cell{ font-family:'Courier New',monospace; font-size:.85rem; max-width:300px; word-break:break-all; text-align:left !important; }
                .id-cell,.rule-cell{ font-family:'Courier New',monospace; font-size:.85rem; white-space:nowrap; }

                /* Footer */
                .report-footer{ background:#ecf0f1; padding:1.5rem; margin-top:3rem; border-top:3px solid #3498db; text-align:center; font-size:.9rem; }
                .report-footer .footer-section{ margin:.5rem 0; }
                .report-footer a{ color:#3498db; text-decoration:none; }
                .report-footer a:hover{ text-decoration:underline; }
                .report-footer .footer-missing{ color:#95a5a6; text-decoration:line-through; cursor:help; }
                """;
        Files.writeString(pagesPath.resolve("style.css"), css, StandardCharsets.UTF_8);
    }
}
