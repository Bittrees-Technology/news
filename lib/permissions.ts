// Shared by navigation and server authorization. Unknown roles fail closed.
export const canManageAccess = (role?: string) => role === "super_admin";
export const canScores = (role?: string) =>
  role === "admin" || role === "super_admin";
export const canReview = (role?: string) =>
  ["moderator", "editor", "admin", "super_admin"].includes(role || "");
export const canApprove = (role?: string) =>
  ["editor", "admin", "super_admin"].includes(role || "");
export function canAccountSection(section: string, role?: string) {
  if (section === "access") return canManageAccess(role);
  if (section === "editorial") return canReview(role);
  return true;
}
