import {BriefingReader} from "@/components/briefing-reader";
import {StoryContent} from "@/components/story-content";
import {notFound} from 'next/navigation';
import {pool} from '@/lib/db';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
async function story(id:string){if(!/^[a-f0-9]{64}$/.test(id))return null;return (await pool().query('SELECT i.*,s.document,s.cid,s.generated_at FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.id=$1 AND i.owner_id IS NULL',[id])).rows[0];}
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const i=await story(id);return i?pageMetadata(i.title,i.document?.briefing.overview?.slice(0,160)||'Source-linked Bittrees briefing',`/story/${id}`):{title:'Story unavailable',robots:{index:false}};}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const i=await story(id);if(!i)notFound();return <BriefingReader initialId={id} olderHref={`/briefings?before=${id}`} entries={[{id,content:<StoryContent item={i}/>}]} />;}
