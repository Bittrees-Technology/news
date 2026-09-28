import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'https://news.bittrees.org';
const fetchPage=(url)=>fetch(url,{headers:{'user-agent':'Twitterbot/1.0'}});
const checks=[['/',200],['/about',200],['/privacy',200],['/terms',200],['/archive',200],['/account',200],['/saved',200],['/unsubscribe',200],['/archive?id=missing-seo-check',404],['/no-such-seo-newspaper',404],['/favicon.ico',200],['/brand/tbn-mark.svg',200],['/brand/tbn-180.png',200],['/brand/social-v4.png',200],['/robots.txt',200],['/sitemap.xml',200],['/manifest.webmanifest',200]];
for(const [path,status] of checks){
 const r=await fetchPage(base+path);const html=await r.text();
 // Next.js can send 200 when notFound follows a streamed layout; these must remain noindex.
 if(status===404&&r.status===200)assert.match(html,/<meta name="robots" content="[^"]*noindex/,path+' streamed not-found must not be indexed');
 else assert.equal(r.status,status,path);
 if(['/','/about','/privacy','/terms','/archive'].includes(path)){
 assert.ok(html.includes('rel="canonical"'),path+' canonical');
 assert.ok(html.includes('name="description"'),path+' description');
 assert.ok(html.includes('property="og:image"'),path+' social image');
 assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html),path+' indexability');
 }
 if(['/account','/saved','/unsubscribe'].includes(path))assert.match(html,/<meta name="robots" content="[^"]*noindex/,path);
 if(path==='/') {assert.ok(html.includes('application/ld+json'));assert.ok(html.includes('/brand/tbn-mark.svg'));}
 if(path==='/sitemap.xml'){assert.ok(!html.includes('/account'));assert.ok(!html.includes('/unsubscribe'));}
 if(path==='/robots.txt')assert.ok(html.includes('Sitemap: https://news.bittrees.org/sitemap.xml'));
 console.log(r.status,path);
}
const home=await (await fetchPage(base+'/')).text();
assert.match(home,/<meta name="viewport"/);
assert.match(home,/<title>TBN(?: \| TBN)?<\/title>/);
const schemas=[...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
assert.ok(schemas.some(s=>s['@type']==='CollectionPage'),'edition collection schema');
assert.ok(schemas.some(s=>s['@graph']?.some(x=>x['@type']==='Organization')),'organization schema');
for(const [path,size] of [['/brand/tbn-180.png',[180,180]],['/brand/tbn-192.png',[192,192]],['/brand/tbn-512.png',[512,512]],['/brand/social-v4.png',[1200,630]]]){
 const r=await fetchPage(base+path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);const b=Buffer.from(await r.arrayBuffer());assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],size);console.log('Image dimensions OK',path);
}
const sitemap=await (await fetch(base+'/sitemap.xml')).text();
const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
assert.equal(new Set(urls).size,urls.length,'unique sitemap URLs');
const dated=urls.find(u=>u.includes('/archive?id='));
if(dated){const r=await fetchPage(base+new URL(dated).pathname+new URL(dated).search);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('href="'+dated.replaceAll('&','&amp;')+'"'));assert.ok(html.includes('CollectionPage'));}
const api=await fetch(base+'/api/session');assert.match(api.headers.get('x-robots-tag')||'',/noindex/);
console.log('Structured data, viewport, dated archive canonical and API noindex passed. Sitemap entries:',urls.length);

const story=urls.find(u=>u.includes('/story/'));
if(story){const r=await fetch(base+new URL(story).pathname,{headers:{'user-agent':'Twitterbot/1.0'}});assert.equal(r.status,200);const html=await r.text();assert.match(html,/<article class="standalone-story">/);assert.match(html,/<meta property="og:type" content="article"/);assert.ok(html.includes('"isBasedOn"'));console.log('Selected briefing is rendered before JavaScript with source attribution');}
