import {pool} from '../lib/db';
try {const r=await pool().query("INSERT INTO story_documents(item_id) SELECT id FROM items WHERE owner_id IS NULL AND published_at>now()-interval '14 days' ON CONFLICT DO NOTHING");console.log(`Queued ${r.rowCount} public briefings.`);}finally{await pool().end();}
