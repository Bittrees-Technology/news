// Sparse feedback stays neutral; many votes by one reader on one source count once.
export function communityAdjustment(sum:number,voters:number,limit:number){
 return voters<5 ? 0 : Math.max(-limit,Math.min(limit,limit*sum/(voters+10)));
}
