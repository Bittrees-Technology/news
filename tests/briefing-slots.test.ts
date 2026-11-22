import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {claimStory} from '../lib/story-documents';

test('only committed claims advance the matching lane, including combined workers',async()=>{
 const state=globalThis as any,previousPool=state.newsPool,previousUrl=process.env.DATABASE_URL;
 let slots:Record<string,number>={},available:'generation'|'archive'|null=null;
 let oldest=false;
 const client={
  async query(sql:string,args:any[]=[]){
   if(sql.startsWith('SELECT data FROM worker_state'))return {rows:[{data:{...slots}}]};
   if(sql.startsWith('SELECT s.*')){
    const [gen,phase,archive]=args;
    assert.ok(['both','generation','archive'].includes(phase));
    if(!available || (available!==phase && phase!=='both'))return {rows:[]};
    oldest=available==='generation'?gen:archive;
    return {rows:[{item_id:'test-story',title:'Source headline',excerpt:'A public source excerpt.',dispatch_priority:50,document:available==='archive'?{}:null}]};
   }
   if(sql.startsWith('UPDATE worker_state'))slots=JSON.parse(args[1]);
   if(sql.startsWith('UPDATE story_documents SET claimed_at'))return {rows:[{lease:randomUUID()}]};
   return {rows:[],rowCount:0};
  },release(){}
 };
 process.env.DATABASE_URL='postgresql://unused';
 state.newsPool={connect:async()=>client};
 try{
  for(let i=0;i<9;i++){
   available='generation';await claimStory({phase:i%2?'both':'generation'});assert.equal(oldest,false);
   available='archive';await claimStory({phase:'both'});assert.equal(oldest,false);
   available=null;assert.equal(await claimStory({phase:'generation'}),null);
  }
  assert.deepEqual(slots,{generation:9,archive:9});
  available='archive';await claimStory({phase:'archive'});assert.equal(oldest,true);
  assert.deepEqual(slots,{generation:9,archive:0});
  available='generation';await claimStory({phase:'both'});assert.equal(oldest,true);
  await claimStory({phase:'generation'});assert.equal(oldest,false);
 }finally{
  state.newsPool=previousPool;
  if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;
 }
});

test('collection and translation persist identical public-source priority despite a personalized view',async()=>{
 const {storeItems}=await import('../lib/collect');
 const {withTranslations}=await import('../lib/translation');
 const {editorialBase}=await import('../lib/editorial-priority');
 const source={id:'test-a',source_id:'test-publisher',topic:'World',title:'County orders mandatory evacuation',kind:'article',url:'https://example.org/flood',excerpt:'The authorities ordered residents to evacuate to a public shelter.',summary_kind:'excerpt',published_at:new Date().toISOString()};
 const state=globalThis as any, previousPool=state.newsPool, previousUrl=process.env.DATABASE_URL;
 let storyScore,translationScore;
 const query=async(sql:string,args:any[] = [])=>{
  if(sql.includes('INSERT INTO items(') || sql.includes('FROM items WHERE id=ANY'))return {rows:[source]};
  if(sql.includes('INSERT INTO story_documents('))storyScore=args[1][0];
  if(sql.includes('INSERT INTO translations('))translationScore=JSON.parse(args[0])[0].priority;
  return {rows:[]};
 };
 process.env.DATABASE_URL='postgresql://unused';state.newsPool={query,connect:async()=>({query,release(){}})};
 try{
  await storeItems([source]);
  await withTranslations([{...source,ranking:{value:1,sourceScore:0,factors:{source:0,freshness:0,relevance:0,grounding:0,completeness:0},version:'custom'}}]);
  assert.equal(storyScore,editorialBase(source));
  assert.equal(translationScore,storyScore);
 }finally{
  state.newsPool=previousPool;
  if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;
 }
});
