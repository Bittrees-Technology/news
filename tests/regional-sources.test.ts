import test from 'node:test';
import assert from 'node:assert/strict';
import {sources} from '../lib/catalog';
import {rssItems} from '../lib/collect';
import {collectionMinutes} from '../lib/collection-policy';
import {publisherFamily} from '../lib/diversity-shadow';
import {creditText, newspaperEmail} from '../lib/newspaper-email';
import {rssDocument} from '../lib/rss';

const source = (id: string) => {
  const result = sources.find(s => s.id === id);
  assert.ok(result, id);
  return result;
};
const regions = ['eia-today-in-energy','taiwan-mofa-releases','eurostat-news','global-voices-mena'].map(source);
const mena = source('global-voices-mena');
const global = source('global-voices');
const now = '2026-11-26T12:00:00Z';
const article = mena.homepage + '2026/11/26/regional-report/';
const entry = (url: string, name: string) => '<item><title>Regional report</title><link>' + url + '</link>' +
  '<description>Publisher synopsis.</description><content:encoded>Full article body</content:encoded>' +
  '<pubDate>Thu, 26 Nov 2026 11:00:00 GMT</pubDate><dc:creator>' + name + '</dc:creator></item>';
const feed = (items: string[]) => '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Global Voices</title>' + items.join('') + '</channel></rss>';

test('four article desks fit the existing allocation and retain their publisher families', () => {
  const scheduled = [...regions, global, source('european-commission')];
  assert(scheduled.reduce((n, s) => n + 1440 / collectionMinutes(s), 0) <= 2 * 1440 / 15);
  for (const s of regions) {
    assert.equal(s.type, 'article');
    assert.equal(s.maxItems, 4);
    assert.ok(s.maxResponseBytes! <= 384 * 1024);
    assert.equal(sources.filter(x => x.url === s.url).length, 1);
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
