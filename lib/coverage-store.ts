import {z} from 'zod';
import {pool,tx} from './db';
import {articleRevision,articleAnnotations,coverageCandidates} from './coverage-review';
import type {Coverage} from './coverage';
import {publisherFamily} from './diversity-shadow';
import {sourceName} from './catalog';
import {HttpError,type Item} from './model';
import {rankingColumns} from './ranking-projection';

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const plain=(limit:number)=>z.string().trim().min(1).max(limit).refine(s=>!/[\x00-\x1f<>]|https?:\/\//i.test(s),'Use plain text');
export const coverageEdit=z.object({
  id:z.uuid(), expectedVersion:z.number().int().min(0), state:z.enum(['approved','withdrawn']),
  title:plain(300),
  reports:z.array(z.object({id:digest,revision:digest,origin:plain(120).nullable()}).strict()).min(2).max(8),
  claims:z.array(z.object({text:plain(500),evidence:z.array(z.object({id:digest,quote:plain(500)}).strict()).min(1).max(8)}).strict()).max(6)
}).strict();
type Edit=z.infer<typeof coverageEdit>;
type Saved=Edit & {version:number};
const columns=rankingColumns+',source_context';
function sameMembers(ids:string[]) {return ids.length===new Set(ids).size;}
export function checkedCoverage(edit:Edit,rows:Item[],version:number):Coverage {
  const lookup=new Map(rows.map(i=>[i.id,i]));
  if(!sameMembers(edit.reports.map(r=>r.id)))throw new HttpError(400,'Duplicate report.');
  const reports=edit.reports.map(r=>{
    const item=lookup.get(r.id);
    if(!item||item.owner_id||item.kind!=='article'||articleRevision(item)!==r.revision)
      throw new HttpError(409,'A report changed or is unavailable. Review the current version.');
    const u=new URL(item.url);
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new HttpError(400,'Invalid report URL.');
    return {id:r.id,outlet:sourceName(item.source_id),title:item.title,url:u.href,
      publishedAt:new Date(item.published_at).toISOString(),authors:item.authors||[]};
  });
  if(new Set(edit.reports.map(r=>publisherFamily(lookup.get(r.id)!))).size<2)throw new HttpError(400,'Select reporting from at least two outlets.');
  const origin=(value:string)=>{
    const v=value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ');
    return ({ap:'associated press',afp:'agence france presse','thomson reuters':'reuters'} as Record<string,string>)[v]||v;
  };
  if(edit.claims.length && new Set(edit.reports.flatMap(r=>r.origin?[origin(r.origin)]:[])).size<2)
    throw new HttpError(400,'A unified briefing requires two confirmed reporting origins.');
  const ids=new Set(reports.map(r=>r.id));
  const claims=edit.claims.map(claim=>{
    for(const evidence of claim.evidence){
      const item=lookup.get(evidence.id);
      if(!ids.has(evidence.id)||!item||evidence.quote.length<10||
        ![item.title,item.excerpt,item.source_context].some(t=>t?.includes(evidence.quote)))
        throw new HttpError(409,'A cited passage is absent from the current report.');
    }
    return {text:claim.text,reports:[...new Set(claim.evidence.map(e=>e.id))]};
  });
  return {id:edit.id,version,title:edit.title,reports,claims};
}
export async function coverageHistory(id:unknown) {
  const event=z.uuid().parse(id);
  return (await pool().query('SELECT version,edit FROM news_coverage_history WHERE event=$1 ORDER BY version DESC LIMIT 20',[event])).rows;
}
export async function reviewDesk(sample=false) {
  const selection=sample?'AND id IN (SELECT item_id FROM news_article_annotations)':'';
  const articles=(await pool().query(`SELECT ${columns} FROM items WHERE owner_id IS NULL AND kind='article' ${selection} ORDER BY published_at DESC,id LIMIT $1`,[sample?200:160])).rows as Item[];
  const events=(await pool().query('SELECT id,version,edit FROM news_coverage_events ORDER BY updated_at DESC LIMIT 30')).rows;
  return {articles:articles.map(i=>({id:i.id,title:i.title,outlet:sourceName(i.source_id),excerpt:i.excerpt,url:i.url,...articleAnnotations(i)})),pairs:coverageCandidates(articles),events};
}
export async function saveCoverage(actor:string,input:unknown){
  const edit=coverageEdit.parse(input);
  return tx(async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[edit.id]);
    const prior=(await db.query('SELECT version FROM news_coverage_events WHERE id=$1',[edit.id])).rows[0];
    if((prior?.version||0)!==edit.expectedVersion)throw new HttpError(409,'Another editor changed this event. Refresh before saving.');
    const version=edit.expectedVersion+1,ids=edit.reports.map(r=>r.id);
    if(edit.state==='approved'){
      const rows=(await db.query(`SELECT ${columns} FROM items WHERE owner_id IS NULL AND id=ANY($1::text[]) FOR SHARE`,[ids])).rows;
      checkedCoverage(edit,rows,version);
    } else if(!prior)throw new HttpError(404,'Unknown event.');
    await db.query('INSERT INTO news_coverage_events(id,version,edit) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET version=excluded.version,edit=excluded.edit,updated_at=now()',[edit.id,version,JSON.stringify(edit)]);
    await db.query('DELETE FROM news_coverage_members WHERE event=$1',[edit.id]);
    if(edit.state==='approved') await db.query('INSERT INTO news_coverage_members(item_id,event) SELECT unnest($1::text[]),$2',[ids,edit.id]).catch(e=>{if(e.code==='23505')throw new HttpError(409,'A report belongs to another approved event.');throw e;});
    await db.query('INSERT INTO news_coverage_history(event,version,actor,edit) VALUES($1,$2,$3,$4)',[edit.id,version,actor,JSON.stringify(edit)]);
    return {id:edit.id,version};
  });
}
export async function reviewedCoverage(items:Item[],channel:'web'|'email'):Promise<Item[]>{
  if(!items.length || process.env.NEWS_COVERAGE_WEB!=='1' || (channel==='email'&&process.env.NEWS_COVERAGE_EMAIL!=='1'))return items;
  const result=await pool().query(`WITH wanted AS (SELECT DISTINCT event FROM news_coverage_members WHERE item_id=ANY($1::text[]))
    SELECT e.id AS event_id,e.edit,e.version,i.id,i.source_id,i.title,i.kind,i.owner_id,i.excerpt,i.source_context,i.url,i.authors,i.published_at
    FROM wanted w JOIN news_coverage_events e ON e.id=w.event JOIN news_coverage_members m ON m.event=e.id
    JOIN items i ON i.id=m.item_id AND i.owner_id IS NULL`,[items.map(i=>i.id)]);
  const events=new Map<string,{edit:Saved,rows:Item[]}>();
  for(const row of result.rows){
    if(!events.has(row.event_id))events.set(row.event_id,{edit:{...row.edit,version:row.version},rows:[]});
    events.get(row.event_id)!.rows.push(row);
  }
  const byId=new Map<string,Coverage>();
  for(const {edit,rows} of events.values()){
    try{
      const group=checkedCoverage(edit,rows,edit.version);
      if(process.env.NEWS_COVERAGE_BRIEFINGS!=='1')group.claims=[];
      for(const report of group.reports)byId.set(report.id,group);
    } catch(e){if(!(e instanceof HttpError))throw e;}
  }
  return items.map(i=>byId.has(i.id)?{...i,coverage:byId.get(i.id)}:i);
}
