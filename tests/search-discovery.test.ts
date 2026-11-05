import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BriefingLinks} from '../components/briefing-links';
import sitemap from '../app/sitemap';
import {generateMetadata as storyMetadata,default as Story} from '../app/story/[id]/page';
import {generateMetadata as queryMetadata,default as Briefings} from '../app/briefings/page';
import {generateMetadata as versionMetadata,default as ArchivedBriefing} from '../app/briefings/[shortId]/page';

const id='a'.repeat(64),cid='b'+'c'.repeat(45);
const item={id,cid,title:'A source title',url:'https://example.org/report',kind:'news',source_id:'example',publication:'Example',authors:[],published_at:'2026-10-20T00:00:00Z',document:{title:'A source title',kind:'news',generatedAt:'2026-10-21T00:00:00Z',source:{url:'https://example.org/report',publication:'Example',authors:[],publishedAt:'2026-10-20T00:00:00Z'},briefing:{overview:'A grounded overview.',points:['A key point.'],limitations:'A source-linked briefing.'}}};

test('story, archived and legacy query metadata agree with the sitemap canonical',async()=>{
 const state=globalThis as any,previous=state.newsPool,old=process.env.DATABASE_URL;
 process.env.DATABASE_URL='postgresql://unused';
 let served:any=item;
 state.newsPool={query:async(sql:string)=>({rows:sql.includes('SELECT s.item_id')?[{item_id:id,cid,generated_at:item.document.generatedAt}]:sql.includes('WHERE i.id=$1')||sql.includes('FROM briefing_versions')?[served]:[]})};
 try{
  const expected='https://news.bittrees.org/briefings/'+'c'.repeat(12);
  const results=[await storyMetadata({params:Promise.resolve({id})}),await queryMetadata({searchParams:Promise.resolve({story:id})}),await versionMetadata({params:Promise.resolve({shortId:'c'.repeat(12)})})];
  for(const result of results){assert.ok('alternates' in result);assert.equal(result.alternates?.canonical,expected);}
  const cursor=await queryMetadata({searchParams:Promise.resolve({before:id})});
  assert.ok('alternates' in cursor);assert.equal(cursor.alternates?.canonical,'https://news.bittrees.org/briefings?before='+id);
  const entries=await sitemap();assert.ok(entries.some(entry=>entry.url===expected));
  assert.ok(!entries.some(entry=>entry.url.endsWith('/story/'+id)));
  served={...item,cid:null,document:null};
  const preparing=await storyMetadata({params:Promise.resolve({id})});
  assert.ok('alternates' in preparing);assert.equal(preparing.alternates?.canonical,'https://news.bittrees.org/story/'+id);
  assert.equal((preparing.robots as {index:boolean}).index,false);
  await assert.rejects(Briefings({searchParams:Promise.resolve({before:'invalid'})}),/NEXT_HTTP_ERROR_FALLBACK;404/);
 }finally{state.newsPool=previous;if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;}
});
test('older public briefings have crawlable links without JavaScript and duplicate entries are removed',()=>{
 const html=renderToStaticMarkup(createElement(BriefingLinks,{entries:[item,item,{id:'b'.repeat(64),title:'<script>Source title</script>'}],next:'d'.repeat(64),currentId:'b'.repeat(64)}));
 assert.equal((html.match(/href="\/briefings\/c{12}"/g)||[]).length,1);
 assert.match(html,/href="\/briefings\?before=d{64}"/);
 assert.doesNotMatch(html,/<script>/);
 const escaped=renderToStaticMarkup(createElement(BriefingLinks,{entries:[{id:'b'.repeat(64),title:'<script>Source title</script>'}],next:null}));
 assert.match(escaped,/&lt;script&gt;Source title&lt;\/script&gt;/);
 assert.equal(renderToStaticMarkup(createElement(BriefingLinks,{entries:[item],next:null,currentId:id})), '');
});
test('private source ownership is enforced for story, archive and legacy discovery entry points',async()=>{
 const state=globalThis as any,previous=state.newsPool,old=process.env.DATABASE_URL;
 process.env.DATABASE_URL='postgresql://unused';
 const privateId='f'.repeat(64),privateCid='b'+'e'.repeat(45);
 const privateItem={...item,id:privateId,cid:privateCid,owner_id:'private-owner',title:'Private briefing fixture'};
 // A private row exists. A query lacking the public-owner condition would return it.
 state.newsPool={query:async(sql:string)=>({rows:sql.includes('i.owner_id IS NULL')?[]:sql.includes('WHERE i.id=$1')||sql.includes('FROM briefing_versions')?[privateItem]:[]})};
 try{
  const params=Promise.resolve({id:privateId}),searchParams=Promise.resolve({story:privateId}),versionParams=Promise.resolve({shortId:'e'.repeat(12)});
  const results=[await storyMetadata({params}),await queryMetadata({searchParams}),await versionMetadata({params:versionParams})];
  for(const result of results)assert.equal((result.robots as {index:boolean}).index,false);
  await assert.rejects(Story({params}),/NEXT_HTTP_ERROR_FALLBACK;404/);
  await assert.rejects(Briefings({searchParams}),/NEXT_HTTP_ERROR_FALLBACK;404/);
  await assert.rejects(ArchivedBriefing({params:versionParams}),/NEXT_HTTP_ERROR_FALLBACK;404/);
 }finally{state.newsPool=previous;if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;}
});
