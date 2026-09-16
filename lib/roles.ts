import { pool } from "./db";
import { HttpError } from "./model";
export const roles = [
  "member",
  "moderator",
  "editor",
  "admin",
  "super_admin",
] as const;
export type NewsRole = (typeof roles)[number];
export const canScores = (role?: string) =>
  role === "admin" || role === "super_admin";
export const canReview = (role?: string) =>
  ["moderator", "editor", "admin", "super_admin"].includes(role || "");
export async function roleForAccount(id?: string): Promise<NewsRole> {
  if (!id) return "member";
  const r = await pool().query(
    `SELECT g.role FROM news_role_grants g JOIN identities i ON i.kind=g.kind AND i.value=g.value WHERE i.account_id=$1 ORDER BY CASE g.role WHEN 'super_admin' THEN 5 WHEN 'admin' THEN 4 WHEN 'editor' THEN 3 WHEN 'moderator' THEN 2 ELSE 1 END DESC LIMIT 1`,
    [id],
  );
  return r.rows[0]?.role || "member";
}
export function requireScores(role?: string) {
  if (!canScores(role))
    throw new HttpError(
      403,
      "Administrator access required for article scores.",
    );
}
// Remove diagnostics before serializing to browsers and personal AI connections.
export function scoreVisibility<T>(data: T, role?: string): T {
  if (canScores(role)) return data;
  const clean = (value: any): any =>
    Array.isArray(value)
      ? value.map(clean)
      : value && typeof value === "object" && !(value instanceof Date)
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([k]) => !["ranking", "source_score"].includes(k))
              .map(([k, v]) => [k, clean(v)]),
          )
        : value;
  return clean(data);
}
