import { pool } from "./db";
import {ecosystemAccess,ecosystemSubject} from './ecosystem-client.mjs';
import { HttpError } from "./model";
export const roles = [
  "member",
  "moderator",
  "editor",
  "admin",
  "super_admin",
] as const;
export type NewsRole = (typeof roles)[number];
export { canScores, canReview, canManageAccess, canApprove } from "./permissions";
import { canScores } from "./permissions";
export function roleFromSharedActions(actions: string[]): NewsRole {
  return [...roles].reverse().find(role =>
    actions.includes('role.' + role.replaceAll('_', '-')) ||
    (role === 'admin' && actions.includes('project.admin'))
  ) || 'member';
}
export async function roleForAccount(id?: string): Promise<NewsRole> {
  if (!id) return "member";
  const shared=await sharedRolesForAccount(id).catch(()=>null);
  // A service failure removes staff authority while personal ownership remains.
  if(!shared)return 'member';
  if(shared.enrolled){
    return roleFromSharedActions(shared.actions);
  }
  const r = await pool().query(
    `SELECT g.role FROM news_role_grants g JOIN identities i ON i.kind=g.kind AND i.value=g.value WHERE i.account_id=$1 ORDER BY CASE g.role WHEN 'super_admin' THEN 5 WHEN 'admin' THEN 4 WHEN 'editor' THEN 3 WHEN 'moderator' THEN 2 ELSE 1 END DESC LIMIT 1`,
    [id],
  );
  return r.rows[0]?.role || "member";
}
export async function sharedRolesForAccount(id:string){
  const identities=(await pool().query('SELECT kind,value FROM identities WHERE account_id=$1 AND verified_at IS NOT NULL ORDER BY kind,value LIMIT 21',[id])).rows;
  const subjects=identities.map(i=>ecosystemSubject('news',i.kind,i.value,process.env.ROLES_FEED_SUBJECT_SECRET));
  return ecosystemAccess('news',subjects,{verifiedEmails:identities.flatMap((i,index)=>i.kind==='email'?[{subject:subjects[index],email:i.value}]:[])});
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
              .filter(([k]) => !["ranking", "source_score", "source_context"].includes(k))
              .map(([k, v]) => [k, clean(v)]),
          )
        : value;
  return clean(data);
}
