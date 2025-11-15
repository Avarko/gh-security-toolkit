import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";

interface ScanMetadata {
    timestamp: string;
    branch: string;
    commitSha: string;
    repository: string;
}

interface TrivyVulnerability {
    VulnerabilityID: string;
    PkgName: string;
    Severity: string;
    Title: string;
    Description?: string;
    PrimaryURL?: string;
}

interface SemgrepFinding {
    check_id: string;
    path: string;
    extra: {
        severity: string;
        message: string;
        lines?: string;
    };
}

export async function clientLoader({ params }: { params: { channel: string; timestamp: string } }) {
    const { channel, timestamp } = params;
    const baseUrl = `/data/runs/${channel}/${timestamp}`;

    const [metadataRes, trivyRes, semgrepRes] = await Promise.all([
        fetch(`${baseUrl}/scan-metadata.json`),
        fetch(`${baseUrl}/trivy-fs-results.json`),
        fetch(`${baseUrl}/semgrep-results.json`),
    ]);

    const metadata: ScanMetadata = await metadataRes.json();
    const trivyData = await trivyRes.json();
    const semgrepData = await semgrepRes.json();

    return json({ metadata, trivyData, semgrepData });
}

export default function RunDetailPage() {
    const { metadata, trivyData, semgrepData } = useLoaderData<typeof clientLoader>();

    const trivyVulns: TrivyVulnerability[] = trivyData?.Results?.flatMap((r: any) => r.Vulnerabilities || []) || [];
    const semgrepFindings: SemgrepFinding[] = semgrepData?.results || [];

    return (
        <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8", padding: "2rem" }}>
            <nav>
                <a href="/">← Dashboard</a> | <a href={`/data/channels/${metadata.repository}`}>← Channel</a>
            </nav>

            <h1>Scan Details</h1>
            <dl style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "0.5rem", marginBottom: "2rem" }}>
                <dt><strong>Timestamp:</strong></dt>
                <dd>{metadata.timestamp}</dd>
                <dt><strong>Repository:</strong></dt>
                <dd>{metadata.repository}</dd>
                <dt><strong>Branch:</strong></dt>
                <dd>{metadata.branch}</dd>
                <dt><strong>Commit:</strong></dt>
                <dd style={{ fontFamily: "monospace" }}>{metadata.commitSha}</dd>
            </dl>

            <h2>Trivy Vulnerabilities ({trivyVulns.length})</h2>
            {trivyVulns.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2rem" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333" }}>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>ID</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Package</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Severity</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Title</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trivyVulns.slice(0, 50).map((v, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>
                                    {v.PrimaryURL ? <a href={v.PrimaryURL} target="_blank" rel="noopener noreferrer">{v.VulnerabilityID}</a> : v.VulnerabilityID}
                                </td>
                                <td style={{ padding: "0.5rem" }}>{v.PkgName}</td>
                                <td style={{ padding: "0.5rem" }}>
                                    <span style={{
                                        padding: "0.2rem 0.5rem",
                                        borderRadius: "4px",
                                        backgroundColor: v.Severity === "CRITICAL" ? "#d32f2f" : v.Severity === "HIGH" ? "#f57c00" : v.Severity === "MEDIUM" ? "#fbc02d" : "#999",
                                        color: "white",
                                        fontSize: "0.85rem"
                                    }}>
                                        {v.Severity}
                                    </span>
                                </td>
                                <td style={{ padding: "0.5rem" }}>{v.Title}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No Trivy vulnerabilities found. ✅</p>
            )}

            <h2>Semgrep Findings ({semgrepFindings.length})</h2>
            {semgrepFindings.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333" }}>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Rule</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Path</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Severity</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {semgrepFindings.slice(0, 50).map((f, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.9rem" }}>{f.check_id}</td>
                                <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.9rem" }}>{f.path}</td>
                                <td style={{ padding: "0.5rem" }}>
                                    <span style={{
                                        padding: "0.2rem 0.5rem",
                                        borderRadius: "4px",
                                        backgroundColor: f.extra.severity === "ERROR" ? "#d32f2f" : f.extra.severity === "WARNING" ? "#f57c00" : "#999",
                                        color: "white",
                                        fontSize: "0.85rem"
                                    }}>
                                        {f.extra.severity}
                                    </span>
                                </td>
                                <td style={{ padding: "0.5rem" }}>{f.extra.message}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No Semgrep findings. ✅</p>
            )}
        </div>
    );
}
