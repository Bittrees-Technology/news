// Complete scoring/display inputs, without the large processing-only source body.
// Keep this shared by collection and public candidate reads.
export const rankingColumns = 'id,source_id,topic,tags,kind,title,url,excerpt,summary,summary_kind,published_at,owner_id,authors,publication,observation_period,released_at,retrieved_at,date_basis';
export function uniqueChangedIds(ids: string[]) { return [...new Set(ids)]; }

export const accountRankingColumns = rankingColumns.split(",").map(column => `i.${column}`).join(",");
