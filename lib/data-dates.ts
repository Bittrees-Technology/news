// An observation period is not its release date. Never invent a release time.
export function annualObservation(year: string, retrievedAt: string) {
 if(!/^\d{4}$/.test(year) || Number(year)<1900 || Number(year)>new Date(retrievedAt).getUTCFullYear()) throw Error('Invalid observation year');
 return {observation_period:year,released_at:null,retrieved_at:retrievedAt,date_basis:'observation' as const,published_at:`${year}-12-31T00:00:00.000Z`};
}
