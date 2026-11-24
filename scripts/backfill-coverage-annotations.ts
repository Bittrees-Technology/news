import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {pool,tx} from '../lib/db';
import type {Item} from '../lib/model';
import {saveAnnotations} from '../lib/persist-annotations';
import {rankingColumns} from '../lib/ranking-projection';

// One reviewed sample per invocation. Read only its public, still-recent articles.
try {
  const ids=z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(200)
    .parse(JSON.parse(await readFile(process.argv[2],'utf8')));
  const result=await tx(async db=>{
    await db.query("SET LOCAL lock_timeout='2s'");
    await db.query("SET LOCAL statement_timeout='8s'");
    const target=await db.query("SELECT current_database()='bittrees_news' AND NOT has_schema_privilege(current_user,'public','CREATE') AS approved");
    if(!target.rows[0]?.approved)throw Error('Use the News runtime account in the News database.');
    const {rows}=await db.query<Item>(`SELECT ${rankingColumns},source_context FROM items
      WHERE id=ANY($1::text[]) AND kind='article' AND owner_id IS NULL
      AND published_at BETWEEN now()-interval '8 days' AND now() ORDER BY id FOR SHARE`,[ids]);
    return {requested:new Set(ids).size,eligible:rows.length,written:await saveAnnotations(db,rows)};
  });
  console.log(JSON.stringify(result));
} finally {await pool().end();}
