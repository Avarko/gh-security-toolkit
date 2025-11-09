<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="${rootCss}">
</head>

<body>
    <header>
        <h1>🔍 Security Scan Report</h1>
        <nav>
            <a href="${linkAllScans}">← All Scans</a>
            <a href="${linkChannelIndex}">← ${channel} Scans</a>
        </nav>
    </header>
    <main>
        <section class="metadata">
            <h2>Scan Information</h2>
            <dl>
                <dt>Timestamp:</dt>
                <dd>${timestampHuman}</dd>
                <dt>Channel:</dt>
                <dd>${channel}</dd>
                <#if metadata?has_content>
                    <#if metadata.branch??>
                        <dt>Branch:</dt>
                        <dd>${metadata.branch}</dd>
                    </#if>
                    <#if metadata.commit_sha??>
                        <dt>Commit:</dt>
                        <dd>${metadata.commit_sha}</dd>
                    </#if>
                    <#if metadata.repository??>
                        <dt>Repository:</dt>
                        <dd>${metadata.repository}</dd>
                    </#if>
                </#if>
            </dl>
        </section>

        <#-- Table of Contents -->
            <section class="toc"
                style="background: #f8f9fa; border-left: 4px solid #0366d6; padding: 1.5rem; margin: 2rem 0; border-radius: 4px;">
                <h2 style="margin-top: 0; color: #24292e;">Table of Contents</h2>
                <ul style="list-style: none; padding: 0; margin: 0.5rem 0;">
                    <#if hasTrivy>
                        <#if (trivyFsVulns?size> 0) || (trivyFsMisconfigs?size > 0)>
                            <li style="margin: 0.5rem 0;">
                                <a href="#trivy-fs" style="text-decoration: none; color: #0366d6; font-weight: 500;">📁
                                    Trivy Filesystem Scan</a>
                                <ul style="list-style: none; padding-left: 1.5rem; margin: 0.25rem 0;">
                                    <#if trivyFsVulns?size gt 0>
                                        <li style="margin: 0.25rem 0;"><a href="#trivy-fs-vulns"
                                                style="text-decoration: none; color: #0366d6;">🔴 Vulnerabilities</a>
                                            <span style="color: #586069;">(${trivyFsVulns?size})</span>
                                        </li>
                                    </#if>
                                    <#if trivyFsMisconfigs?size gt 0>
                                        <li style="margin: 0.25rem 0;"><a href="#trivy-fs-misconfigs"
                                                style="text-decoration: none; color: #0366d6;">⚙️ Misconfigurations</a>
                                            <span style="color: #586069;">(${trivyFsMisconfigs?size})</span>
                                        </li>
                                    </#if>
                                </ul>
                            </li>
                        </#if>
                        <#if (trivyImageVulns?size> 0) || (trivyImageMisconfigs?size > 0)>
                            <li style="margin: 0.5rem 0;">
                                <a href="#trivy-image"
                                    style="text-decoration: none; color: #0366d6; font-weight: 500;">🐳 Trivy Image
                                    Scan</a>
                                <ul style="list-style: none; padding-left: 1.5rem; margin: 0.25rem 0;">
                                    <#if trivyImageVulns?size gt 0>
                                        <li style="margin: 0.25rem 0;"><a href="#trivy-image-vulns"
                                                style="text-decoration: none; color: #0366d6;">🔴 Vulnerabilities</a>
                                            <span style="color: #586069;">(${trivyImageVulns?size})</span>
                                        </li>
                                    </#if>
                                    <#if trivyImageMisconfigs?size gt 0>
                                        <li style="margin: 0.25rem 0;"><a href="#trivy-image-misconfigs"
                                                style="text-decoration: none; color: #0366d6;">⚙️ Misconfigurations</a>
                                            <span style="color: #586069;">(${trivyImageMisconfigs?size})</span>
                                        </li>
                                    </#if>
                                </ul>
                            </li>
                        </#if>
                    </#if>
                    <#if hasSemgrepFindings>
                        <li style="margin: 0.5rem 0;"><a href="#semgrep"
                                style="text-decoration: none; color: #0366d6; font-weight: 500;">🔍 Semgrep Results</a>
                            <span style="color: #586069;">(${semgrepFindings?size} findings)</span>
                        </li>
                        <#elseif semgrepSummaryMd??>
                            <li style="margin: 0.5rem 0;"><a href="#semgrep"
                                    style="text-decoration: none; color: #0366d6; font-weight: 500;">🔍 Semgrep
                                    Results</a></li>
                    </#if>
                    <#if hasDependabot>
                        <li style="margin: 0.5rem 0;"><a href="#dependabot"
                                style="text-decoration: none; color: #0366d6; font-weight: 500;">🤖 Dependabot
                                Alerts</a></li>
                    </#if>
                </ul>
            </section>

            <#if hasTrivy>
                <section class="summary trivy" id="trivy-results">
                    <h2>Trivy Results</h2>
                    <#if (trivyFsVulns?size==0) && (trivyFsMisconfigs?size==0) && (trivyImageVulns?size==0) &&
                        (trivyImageMisconfigs?size==0)>
                        <p>✓ No issues found.</p>
                        <#else>
                            <#if (trivyFsVulns?size> 0) || (trivyFsMisconfigs?size > 0)>
                                <h3 id="trivy-fs">Filesystem Scan</h3>

                                <#if trivyFsVulns?size gt 0>
                                    <h4 id="trivy-fs-vulns">Vulnerabilities</h4>
                                    <#assign findings=trivyFsVulns>
                                        <#include "_trivy_table.ftl">
                                </#if>

                                <#if trivyFsMisconfigs?size gt 0>
                                    <h4 id="trivy-fs-misconfigs">Misconfigurations</h4>
                                    <#assign findings=trivyFsMisconfigs>
                                        <#include "_trivy_table.ftl">
                                </#if>

                                <#if jsonFsPath??>
                                    <p><a href="${jsonFsPath}" class="json-link">📄 View Full JSON</a></p>
                                </#if>
                            </#if>

                            <#if (trivyImageVulns?size> 0) || (trivyImageMisconfigs?size > 0)>
                                <h3 id="trivy-image">Image Scan</h3>

                                <#if trivyImageVulns?size gt 0>
                                    <h4 id="trivy-image-vulns">Vulnerabilities</h4>
                                    <#assign findings=trivyImageVulns>
                                        <#include "_trivy_table.ftl">
                                </#if>

                                <#if trivyImageMisconfigs?size gt 0>
                                    <h4 id="trivy-image-misconfigs">Misconfigurations</h4>
                                    <#assign findings=trivyImageMisconfigs>
                                        <#include "_trivy_table.ftl">
                                </#if>

                                <#if jsonImagePath??>
                                    <p><a href="${jsonImagePath}" class="json-link">📄 View Full JSON</a></p>
                                </#if>
                            </#if>
                    </#if>
                </section>
            </#if>

            <#if hasSemgrepFindings>
                <section class="summary semgrep" id="semgrep">
                    <h2>Semgrep Results</h2>
                    <#include "_semgrep_table.ftl">
                        <#if jsonSemgrepPath??>
                            <p><a href="${jsonSemgrepPath}" class="json-link">📄 View JSON</a></p>
                        </#if>
                </section>
                <#elseif semgrepSummaryMd??>
                    <section class="summary semgrep" id="semgrep">
                        <h2>Semgrep Summary</h2>
                        <pre>${semgrepSummaryMd}</pre>
                    </section>
            </#if>

            <#if dependabotSummaryMd??>
                <section class="summary dependabot" id="dependabot">
                    <h2>Dependabot Alerts</h2>
                    <div class="markdown-content">
                        <pre>${dependabotSummaryMd}</pre>
                    </div>
                </section>
            </#if>

            <#if (!hasTrivy) && (!hasSemgrepFindings) && (!hasDependabot)>
                <section class="no-issues">
                    <h2>✅ No Security Issues Found!</h2>
                    <p>All scans completed successfully with no vulnerabilities, misconfigurations, or alerts detected.
                    </p>
                </section>
            </#if>
    </main>
    <#include "_footer.ftl">
</body>

</html>