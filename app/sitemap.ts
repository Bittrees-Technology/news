import type {MetadataRoute} from 'next';
import {pool} from '@/lib/db';
import {siteUrl} from '@/lib/seo';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const entries:MetadataRoute.Sitemap=['','/about','/privacy','/terms','/archive','/briefings'].map(path=>({url:siteUrl+path}));
 const editions=(await pool().query('SELECT id,published_at FROM editions WHERE published_at IS NOT NULL ORDER BY publish_at DESC LIMIT 1000')).rows;
 if(editions[0])entries[0].lastModified=editions[0].published_at;
 for(const e of editions)entries.push({url:siteUrl+'/archive?id='+encodeURIComponent(e.id),lastModified:e.published_at});
 const papers=(await pool().query("SELECT n.slug,n.last_published_at,jsonb_path_query_array(n.snapshot::jsonb, '$.feeds[*].slug') AS snapshot_feed_slugs,COALESCE((SELECT json_agg(f.slug) FROM newspaper_feeds f WHERE f.account_id=n.account_id),'[]'::json) AS feed_slugs FROM newspapers n WHERE n.published=true AND n.snapshot IS NOT NULL ORDER BY n.slug LIMIT 5000")).rows;
 for(const p of papers){
 const url=siteUrl+'/'+encodeURIComponent(p.slug);
 entries.push({url,lastModified:p.last_published_at||undefined});
 for(const slug of p.feed_slugs)if(p.snapshot_feed_slugs?.includes(slug))entries.push({url:url+'/'+encodeURIComponent(slug),lastModified:p.last_published_at||undefined});
 }
 const stories=(await pool().query("SELECT s.item_id,s.generated_at FROM story_documents s JOIN items i ON i.id=s.item_id WHERE s.document IS NOT NULL AND i.owner_id IS NULL ORDER BY s.generated_at DESC,s.item_id LIMIT 5000")).rows;
 for(const s of stories)entries.push({url:siteUrl+"/story/"+s.item_id,lastModified:s.generated_at});
 return entries;
}
