import {pool} from '../lib/db';
import {articleTags} from '../lib/tags';
let after='',total=0;
try{while(true){
 const rows=(await pool().query('SELECT id,source_id,owner_id,topic,tags,title,excerpt,summary FROM items WHERE id>$1 ORDER BY id LIMIT 500',[after])).rows;
 if(!rows.length)break;
 const updates=rows.map(i=>{ const tags=articleTags(i); return {id:i.id,topic:tags[0],tags}; });
 await pool().query("UPDATE items i SET topic=x.topic,tags=x.tags FROM jsonb_to_recordset($1::jsonb) AS x(id text,topic text,tags text[]) WHERE i.id=x.id",[JSON.stringify(updates)]);
 after=rows.at(-1)!.id;total+=rows.length;
}console.log(`Updated tags for ${total} articles; no feedback records created.`);}finally{await pool().end();}
