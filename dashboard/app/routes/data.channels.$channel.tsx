import { useLoaderData, useParams } from "@remix-run/react";

export async function clientLoader({ params }: { params: { channel: string } }) {
    const response = await fetch("/data/hist/scan-history.json");
    const history = await response.json();

    const channelScans = history.entries?.filter(
        (entry: any) => entry.channel === params.channel
    ) || [];

    return { channel: params.channel, scans: channelScans };
}

export default function ChannelPage() {
    const { channel, scans } = useLoaderData<typeof clientLoader>();

    return (
        <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8", padding: "2rem" }}>
            <nav>
                <a href="/">← Back to Dashboard</a>
            </nav>

            <h1>Channel: {channel}</h1>
            <p>Total scans: {scans.length}</p>

            {scans.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #333" }}>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Timestamp</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Branch</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Commit</th>
                            <th style={{ textAlign: "right", padding: "0.5rem" }}>Trivy Critical</th>
                            <th style={{ textAlign: "right", padding: "0.5rem" }}>Trivy High</th>
                            <th style={{ textAlign: "right", padding: "0.5rem" }}>Semgrep Errors</th>
                            <th style={{ textAlign: "left", padding: "0.5rem" }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scans.map((scan: any) => (
                            <tr key={scan.timestamp} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "0.5rem" }}>{scan.timestamp}</td>
                                <td style={{ padding: "0.5rem" }}>{scan.metadata?.branch || "—"}</td>
                                <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>
                                    {scan.metadata?.commitSha?.substring(0, 7) || "—"}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                    {scan.stats?.trivy?.critical || 0}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                    {scan.stats?.trivy?.high || 0}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                    {scan.stats?.semgrep?.error || 0}
                                </td>
                                <td style={{ padding: "0.5rem" }}>
                                    <a href={`/data/runs/${channel}/${scan.timestamp}`}>View</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>No scans found for this channel.</p>
            )}
        </div>
    );
}
