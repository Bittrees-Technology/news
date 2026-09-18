import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'https://news.bittrees.org';
const checks=[['/',200],['/about',200],['/privacy',200],['/terms',200],['/archive',200],['/account',200],['/saved',200],['/unsubscribe',200],['/archive?id=missing-seo-check',404],['/no-such-seo-newspaper',404],['/favicon.ico',200],['/brand/tbn-mark.svg',200],['/brand/tbn-180.png',200],['/brand/social.png',200],['/robots.txt',200],['/sitemap.xml',200],['/manifest.webmanifest',200]];
for(const [path,status] of checks){
 const r=await fetch(base+path);assert.equal(r.status,status,path);const html=await r.text();
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
 console.log(status,path);
}
