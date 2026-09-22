export const roleOrder=['member','moderator','editor','admin','super_admin'] as const;
export type ActiveRole=typeof roleOrder[number];
// Higher staff grants include the existing lower-role capabilities.
export function availableRoles(highest:string):ActiveRole[]{
 const index=roleOrder.indexOf(highest as ActiveRole);
 return [...roleOrder.slice(0,Math.max(0,index)+1)];
}
export function effectiveRole(highest:string,selected:string|null|undefined):ActiveRole{
 const allowed=availableRoles(highest);
 return selected==null?allowed[allowed.length-1]:allowed.includes(selected as ActiveRole)?selected as ActiveRole:'member';
}
