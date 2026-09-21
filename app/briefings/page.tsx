import {pool} from '@/lib/db';
import {withTranslations} from '@/lib/translation';
import {StoryContent} from '@/components/story-content';
import {BriefingReader} from '@/components/briefing-reader';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
export const metadata=pageMetadata('Summary','Read TBN summaries, one at a time, in publication order.','/briefings');
export default async function Page({searchParams}:{searchParams:Promise<{story?:string;before?:string}>}){
 const {story,before}=await searchParams;
 const cursor=before && /^[a-f0-9]{64}$/.test(before)?before:null;
 const selected=story && /^[a-f0-9]{64}$/.test(story)?story:null;
 const rows=(await pool().query(`SELECT i.*,s.document,s.cid,s.generated_at FROM items i JOIN story_documents s ON s.item_id=i.id WHERE i.owner_id IS NULL AND s.document IS NOT NULL AND i.published_at<=now() AND ($1::text IS NULL OR (i.published_at,i.id)<(SELECT published_at,id FROM items WHERE id=$1 AND owner_id IS NULL)) ORDER BY i.published_at DESC,i.id DESC LIMIT 100`,[cursor])).rows;
 if(selected&&!rows.some(i=>i.id===selected)){
  const row=(await pool().query('SELECT i.*,s.document,s.cid,s.generated_at FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.id=$1 AND i.owner_id IS NULL AND i.published_at<=now()',[selected])).rows[0];
  if(row)rows.push(row);
 }
 const translated=await withTranslations(rows);
 const byId=new Map(translated.map(i=>[i.id,i]));
 rows.sort((a,b)=>new Date(b.published_at).getTime()-new Date(a.published_at).getTime()||b.id.localeCompare(a.id));
 return <BriefingReader key={selected||cursor||"latest"} olderHref={rows.length?`/briefings?before=${rows[rows.length-1].id}`:"/briefings"} initialId={selected} entries={rows.map(i=>({id:i.id,content:<StoryContent item={{...i,...byId.get(i.id)}}/>}))}/>;
}
