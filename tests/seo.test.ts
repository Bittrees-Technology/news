import test from 'node:test';
import assert from 'node:assert/strict';
import {briefingMetadata,briefingSchema,schemaJson} from '../lib/briefing-seo';
import {pageMetadata,siteDescription} from '../lib/seo';
import sitemap from '../app/sitemap';
const item={title:'Original title',translation:{title:'English title'},url:'https://example.org/report',authors:['Source reporter'],publication:'Source publication',published_at:'2026-09-27T12:00:00Z',document:{generatedAt:'2026-09-28T10:00:00Z',briefing:{overview:'A grounded overview.'}}};
test('public previews use TBN and translated briefing titles and creation dates',()=>{
 assert.equal(pageMetadata('The Bittrees News',siteDescription,'/').title,'TBN');
 const metadata=briefingMetadata(item,'/story/example');
 assert.equal(metadata.title,'English title');
 assert.equal((metadata.openGraph as any).publishedTime,item.document.generatedAt);
 assert.equal(metadata.alternates?.canonical,'https://news.bittrees.org/story/example');
 assert.equal((briefingMetadata({...item,document:undefined},'/story/example').robots as any).index,false);
});
test('briefing schema separates original authorship and dates and escapes embedded HTML',()=>{
 const schema=briefingSchema(item,'/story/example')!;
 assert.equal(schema.author.name,'TBN');assert.equal(schema.isBasedOn.author?.[0].name,'Source reporter');
 assert.equal(schema.datePublished,item.document.generatedAt);assert.equal(schema.isBasedOn.datePublished,item.published_at);
 assert.ok(!schemaJson({title:'</script><script>alert(1)</script>'}).includes('<'));
 assert.equal(briefingSchema({...item,document:undefined},'/story/example'),null);
});
test('sitemap selects only public completed stories and published snapshot feeds',async()=>{
 const oldUrl=process.env.DATABASE_URL;process.env.DATABASE_URL="postgresql://unused";
 const state=globalThis as any;const previous=state.newsPool;const queries:string[]=[];
 state.newsPool={query:async(sql:string)=>{queries.push(sql);return {rows:sql.includes('FROM newspapers')?[{slug:'paper',snapshot_feed_slugs:['science'],feed_slugs:['science','private-draft']}]:[]};}};
 try{
  const entries=await sitemap();
  assert.ok(queries.some(q=>q.includes('i.owner_id IS NULL')&&q.includes('s.document IS NOT NULL')));
  assert.ok(entries.some(e=>e.url.endsWith('/paper/science')));
  assert.ok(!entries.some(e=>e.url.includes('private-draft')));
 }finally{state.newsPool=previous;if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;}
});
