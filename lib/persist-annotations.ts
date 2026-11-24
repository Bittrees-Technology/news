import type {PoolClient} from 'pg';
import {articleAnnotations} from './coverage-review';
import type {Item} from './model';

export async function saveAnnotations(db:PoolClient, items:Item[]) {
  const annotations=Object.fromEntries(items.filter(i=>i.owner_id===null && i.kind==='article')
    .map(item=>[item.id,articleAnnotations(item)]));
  if(!Object.keys(annotations).length)return 0;
  const result=await db.query(`INSERT INTO news_article_annotations(item_id,version,revision,facets)
    SELECT key,(value->>'version')::integer,value->>'revision',value FROM jsonb_each($1::jsonb)
    ON CONFLICT(item_id) DO UPDATE SET version=excluded.version,revision=excluded.revision,facets=excluded.facets
    WHERE (news_article_annotations.version,news_article_annotations.revision) IS DISTINCT FROM (excluded.version,excluded.revision)`,[JSON.stringify(annotations)]);
  return result.rowCount||0;
}
