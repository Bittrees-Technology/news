import {createHash} from 'node:crypto';
type EvidenceSource={title:string;kind:string;source_id:string;source_context?:string|null;excerpt?:string|null;fetched_at?:string|Date|null};
/** Feed size never establishes full-text rights or completeness. */
export function sourceEvidence(i:EvidenceSource){
 const body=i.source_context?.trim()||i.excerpt?.trim()||'';
 const structured=i.kind==='data'&&['world-bank-gdp','defillama-protocols'].includes(i.source_id);
 const retrieved=i.fetched_at?new Date(i.fetched_at):null;
 return {
  version:1,
  kind:!body?'title-only':structured?'structured-observation':i.kind==='podcast'?'episode-description':'feed-excerpt',
  completeness:body?'partial':'unavailable',
  fullTextStatus:'not-acquired',
  sourceLanguage:null,
  retrievedAt:retrieved&&!Number.isNaN(retrieved.getTime())?retrieved.toISOString():null,
  revision:createHash('sha256').update(JSON.stringify([i.title,body])).digest('hex'),
 };
}
export function evidenceLabel(kind:string){
 if(kind==='structured-observation')return 'Based on a data snapshot, not a complete dataset.';
 if(kind==='episode-description')return 'Based on the episode description, not a full transcript.';
 if(kind==='title-only')return 'Only the source title was available; full content has not been acquired.';
 return 'Based on a feed excerpt; full article content has not been acquired.';
}
