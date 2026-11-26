import test from 'node:test';
import assert from 'node:assert/strict';
import {allSources, sources, sourceName, sourceLicense} from '../lib/catalog';
import {rssItems} from '../lib/collect';
import {collectionMinutes} from '../lib/collection-policy';
import {publisherFamily} from '../lib/diversity-shadow';
import {creditText, newspaperEmail} from '../lib/newspaper-email';
import {rssDocument} from '../lib/rss';

const source = (id: string) => {
  const result = allSources.find(s => s.id === id);
  assert.ok(result, id);
  return result;
};
const publishers = ['techdirt','factly','scidev-net','times-of-israel'].map(source);
const mena = source('global-voices-mena');
const global = source('global-voices');
const now = '2026-11-26T12:00:00Z';
const article = mena.homepage + '2026/11/26/regional-report/';
const entry = (url: string, name: string) => '<item><title>Regional report</title><link>' + url + '</link>' +
  '<description>Publisher synopsis.</description><content:encoded>Full article body</content:encoded>' +
  '<pubDate>Thu, 26 Nov 2026 11:00:00 GMT</pubDate><dc:creator>' + name + '</dc:creator></item>';
const feed = (items: string[]) => '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Global Voices</title>' + items.join('') + '</channel></rss>';

test('new sources are previously unrepresented publishers within the collection budget', () => {
  const names = new Set(publishers.map(s => s.id));
  const priorFamilies = new Set(allSources.filter(s => !names.has(s.id)).map(s => publisherFamily({source_id:s.id})));
  const families = publishers.map(s => publisherFamily({source_id:s.id}));
  assert.equal(new Set(families).size, publishers.length);
  assert(families.every(f => !priorFamilies.has(f)));
  const affected = [...publishers, source('eia-today-in-energy'), source('taiwan-mofa-releases')];
  assert(affected.reduce((n, s) => n + 1440 / collectionMinutes(s), 0) <= 7);
  for (const s of publishers) {
    assert(sources.includes(s));
    assert.equal(s.type, 'article');
    assert.equal(s.maxItems, 4);
    assert.ok(s.maxResponseBytes! <= 256 * 1024);
    assert.equal(sources.filter(x => x.url === s.url).length, 1);
  }
  for (const s of [mena, source('eurostat-news')]) {
    assert(!sources.includes(s));
    assert.equal(sourceName(s.id), s.name);
    assert.equal(sourceLicense(s.id)?.name, s.license?.name);
  }
  assert.equal(publisherFamily({source_id:mena.id}), publisherFamily({source_id:global.id}));
  assert.equal(publisherFamily({source_id:'eurostat-news'}), publisherFamily({source_id:'european-commission'}));
});

test('overlapping desks admit the same signed excerpt once under a stable identity', async () => {
  const sample = feed([entry(article, 'N. &amp; D.'), entry(article, 'N. &amp; D.'), entry(article+'unsigned','')]);
  const [regional] = await rssItems(mena, sample, now, undefined, mena);
  const [general] = await rssItems(global, sample, now, undefined, global);
  assert.equal((await rssItems(mena,sample,now,undefined,mena)).length, 1);
  assert.equal(regional.id, general.id);
  assert.equal(regional.publication, general.publication);
  assert.equal(regional.source_context, 'Publisher synopsis.');
  assert.equal(regional.source_context, general.source_context);
  assert.deepEqual(regional.authors, ['N. & D.']);
  const html = newspaperEmail('Daily',[regional],now,'https://example.org/pause');
  assert.match(html,/N\. &amp; D\./);
  assert.ok(html.includes(article));
  const text = creditText(regional.source_id, regional.authors);
  const rss = rssDocument({title:'Daily', description:'News', url:article, self:article, items:[regional]});
  for (const output of [html,text,rss]) assert.ok(output.includes(mena.license!.url));
  assert.match(rss, /<dc:creator>N\. &amp; D\.<\/dc:creator>/);
});

test('Atom admission requires an explicit summary and ignores the full article body', async () => {
  const eurostat = source('eurostat-news');
  function atom(summary: string) {
    return '<feed xmlns="http://www.w3.org/2005/Atom"><title>News</title><entry><title>Housing</title>' +
      '<link href="' + eurostat.homepage + 'housing"/><updated>' + now + '</updated>' +
      '<content>Full article body</content>' + summary + '</entry></feed>';
  }
  assert.equal((await rssItems(eurostat, atom(''), now, undefined, eurostat)).length, 0);
  const [result] = await rssItems(eurostat, atom('<summary>Statistical release.</summary>'), now, undefined, eurostat);
  assert.equal(result.source_context, 'Statistical release.');
});

test('Times of Israel includes only its syndicated headline and short subheadline', async () => {
  const s = source('times-of-israel');
  const make = (description: string) => feed([entry(s.homepage+'story/', '').replace(
    '<description>Publisher synopsis.</description>', description)]);
  const read = (description: string) => rssItems(s, make(description), now, undefined, s);
  const [item] = await read('<description><![CDATA[The published subheadline.<figure><img src="x"/><figcaption>Photo credit</figcaption></figure>]]></description>');
  assert.equal(item.source_context, 'The published subheadline.');
  for (const body of ['', '<description><![CDATA[<p>Article body</p>]]></description>', '<description>'+'a'.repeat(401)+'</description>']) {
    assert.equal((await read(body)).length, 0);
  }
});

test('new publisher sources preserve written fact checks and skip videos and sponsored deals', async () => {
  const factly = source('factly');
  const check = entry(factly.homepage+'article/', 'Reporter').replace('Regional report','Fact check of a video');
  const video = check.replace('article/', 'another/').replace('</item>', '<category>Videos</category></item>');
  assert.deepEqual((await rssItems(factly,feed([video,check]),now,undefined,factly)).map(i=>i.url), [factly.homepage+'article/']);
  const techdirt = source('techdirt');
  const promo = entry(techdirt.homepage+'promo/', 'Reporter').replace('Regional report','Daily Deal: example');
  assert.equal((await rssItems(techdirt,feed([promo]),now,undefined,techdirt)).length,0);
});
