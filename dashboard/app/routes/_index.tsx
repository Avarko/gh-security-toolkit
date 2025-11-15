import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";

export async function clientLoader() {
    const response = await fetch("/data/hist/scan-history.json");
    const history = await response.json();
    return json({ history });
}

export default function Index() {
    const { history } = useLoaderData<typeof clientLoader>();

    return (
        <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8", padding: "2rem" }}>
            <h1>Security Scan Dashboard</h1>
            <h2>Scan History (v{history.version})</h2>
            <p>Total scans: {history.entries?.length || 0}</p>

            {history.entries && history.entries.length > 0 ? (
                <div>
                    <h3>Recent Scans</h3>
                    <ul>
                        {history.entries.slice(0, 10).map((entry: any) => (
                            <li key={`${entry.channel}-${entry.timestamp}`}>
                                <strong>{entry.channel}</strong> - {entry.timestamp}
                                <br />
                                Branch: {entry.metadata?.branch || "unknown"} |
                                Commit: {entry.metadata?.commitSha?.substring(0, 7) || "unknown"}
                                <br />
                                Trivy: {entry.stats?.trivy?.critical || 0} critical, {entry.stats?.trivy?.high || 0} high
                                {" | "}
                                Semgrep: {entry.stats?.semgrep?.error || 0} errors, {entry.stats?.semgrep?.warning || 0} warnings
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p>No scan data available.</p>
            )}

            <h3>Channels</h3>
            <p>Browse by channel:</p>
            <ul>
                {Array.from(new Set(history.entries?.map((e: any) => e.channel) || [])).map((channel: any) => (
                    <li key={channel}>
                        <a href={`/data/channels/${channel}`}>{channel}</a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
