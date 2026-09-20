import {pool} from './db';import {diversityShadow} from './diversity-shadow';
export async function recordDiversityShadow(){
 const rows=(await pool().query('SELECT id,data FROM editions WHERE id=(SELECT id FROM editions WHERE published_at IS NOT NULL ORDER BY publish_at DESC LIMIT 1) AND NOT EXISTS(SELECT 1 FROM diversity_shadows s WHERE s.edition_id=editions.id) ORDER BY publish_at DESC LIMIT 1')).rows;
 if(rows[0])await pool().query('INSERT INTO diversity_shadows(edition_id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[rows[0].id,JSON.stringify(diversityShadow(rows[0].data.items))]);
}
