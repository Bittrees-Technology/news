import { pool } from "./db";
import { sources } from "./catalog";
export type SourceHealth = {
  healthy: number;
  unavailable: number;
  unchecked: number;
  checkedAt: string | null;
  issues: { name: string; homepage: string; reason: string }[];
};
export function sourceIssue(error: string | null) {
  if (error?.includes("HTTP 403") || error?.includes("HTTP 401"))
    return "Publisher declined automated feed access";
  if (error?.includes("HTTP 429"))
    return "Publisher request limit reached; retrying at the next collection";
  if (error?.includes("too large")) return "Feed exceeds the download limit";
  if (error?.includes("Private network") || error?.includes("public HTTPS"))
    return "Feed address failed the public-network safety check";
  if (error?.includes("timeout") || error?.includes("aborted"))
    return "Feed did not respond in time";
  return "Feed could not be collected; retrying at the next collection";
}
export async function sourceHealth(): Promise<SourceHealth> {
  const rows = (
    await pool().query(
      "SELECT id,status,error,checked_at FROM sources WHERE id=ANY($1::text[])",
      [sources.map((s) => s.id)],
    )
  ).rows;
  const dates = rows.flatMap((r) =>
    r.checked_at ? [new Date(r.checked_at).getTime()] : [],
  );
  return {
    healthy: rows.filter((r) => r.status === "healthy").length,
    unavailable: rows.filter((r) => r.status === "unavailable").length,
    unchecked:
      sources.length -
      rows.filter((r) => r.status === "healthy" || r.status === "unavailable")
        .length,
    checkedAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    issues: rows
      .filter((r) => r.status === "unavailable")
      .map((r) => {
        const s = sources.find((s) => s.id === r.id)!;
        return {
          name: s.name,
          homepage: s.homepage,
          reason: sourceIssue(r.error),
        };
      }),
  };
}
