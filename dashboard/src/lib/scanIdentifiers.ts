/**
 * The two identifiers that address a scan: its channel and its timestamp.
 *
 * They are not only display values. ChannelScanRunDetailRoute builds
 * `<dataRoot>/runs/<channel>/<timestamp>` and fetches it, so anything that
 * passes here decides which path is requested. Route parameters come from the
 * URL, where a percent-encoded `../` survives React Router's decoding and
 * redirects the fetch -- within one origin, which in a multi-tenant deployment
 * sharing an origin means across the separation the routes imply.
 *
 * The character sets are the ones the publishing side already produces, so
 * nothing a real scan writes is affected.
 */
import { z } from "zod";

const MAX_CHANNEL_LENGTH = 100;
const MAX_TIMESTAMP_LENGTH = 64;

export const channelSchema = z
    .string()
    .min(1)
    .max(MAX_CHANNEL_LENGTH)
    .regex(/^[a-zA-Z0-9\-_]+$/, "Invalid channel name");

/**
 * YYYYMMDD-HHMMSS, plus the legacy YYYY-MM-DD-HHMMSSZ form.
 *
 * Published history retains every scan ever recorded, so entries written
 * before the switch to compact timestamps are still in it, and both
 * TimestampUtils and formatTimestamp parse the legacy form deliberately.
 */
export const timestampSchema = z
    .string()
    .max(MAX_TIMESTAMP_LENGTH)
    .regex(
        /^(\d{8}-\d{6}|\d{4}-\d{2}-\d{2}-\d{6}Z)$/,
        "Invalid timestamp format (expected YYYYMMDD-HHMMSS)",
    );

/**
 * Validates the pair before they are used to build a path.
 *
 * Returns null when either is unusable, which the caller renders as a load
 * error rather than fetching something else.
 */
export function parseScanAddress(
    channel: string | undefined,
    timestamp: string | undefined,
): { channel: string; timestamp: string } | null {
    const parsedChannel = channelSchema.safeParse(channel);
    const parsedTimestamp = timestampSchema.safeParse(timestamp);

    if (!parsedChannel.success || !parsedTimestamp.success) {
        return null;
    }

    return { channel: parsedChannel.data, timestamp: parsedTimestamp.data };
}
