import {pool} from '../lib/db';
import {articleTags,normalizeTopic} from '../lib/tags';
let after='',total=0;
try{while(true){
 const rows=(await pool().query('SELECT id,topic,tags,title,excerpt,summary FROM items WHERE id>$1 ORDER BY id LIMIT 500',[after])).rows;
 if(!rows.length)break;
 const updates=rows.map(i=>({id:i.id,topic:normalizeTopic(i.topic),tags:articleTags(i)}));
 await pool().query("UPDATE items i SET topic=x.topic,tags=x.tags FROM jsonb_to_recordset($1::jsonb) AS x(id text,topic text,tags text[]) WHERE i.id=x.id",[JSON.stringify(updates)]);
 after=rows.at(-1)!.id;total+=rows.length;
}console.log(`Updated tags for ${total} articles; no feedback records created.`);}finally{await pool().end();}
