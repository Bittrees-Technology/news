import test from 'node:test';
import assert from 'node:assert/strict';
import {sources} from '../lib/catalog';
import {rssItems} from '../lib/collect';
import {collectionMinutes} from '../lib/collection-policy';
import {publisherFamily} from '../lib/diversity-shadow';
import {newspaperEmail} from '../lib/newspaper-email';

const brazil = sources.find(s => s.id === 'agencia-brasil-education')!;
const southAfrica = sources.find(s => s.id === 'sanews-south-africa')!;
const when = '2026-11-26T12:00:00Z';
const byline = 'Ana Silva - Repórter da Agência Brasil';
function entry(url: string, author = byline, date = when) {
  return '<item><title>School term begins</title><link>' + url + '</link><description>Classes resume this week.</description>' +
    (date ? '<pubDate>' + new Date(date).toUTCString() + '</pubDate>' : '') +
    (author ? '<dc:creator>' + author + '</dc:creator>' : '') + '</item>';
}
const rss = (entries: string[]) => '<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Feed Editoria</title>' + entries.join('') + '</channel></rss>';

test('geographic expansion fits the former polling allocation and keeps publisher families distinct', () => {
  const economy = sources.find(s => s.id === 'agencia-brasil-economy')!;
  const observador = sources.find(s => s.id === 'observador')!;
  const perDay = (s: typeof brazil) => 1440 / collectionMinutes(s);
  assert(perDay(observador) + perDay(economy) + perDay(brazil) + perDay(southAfrica) <= 1440 / 15 + 1440 / 120);
  assert(perDay(brazil) + perDay(economy) <= 1440 / 120);
  for (const source of [brazil, southAfrica]) {
    assert.equal(source.maxItems, 4);
    assert.equal(source.maxResponseBytes, 256 * 1024);
  }
  assert.equal(publisherFamily({source_id:brazil.id}), publisherFamily({source_id:economy.id}));
  assert.notEqual(publisherFamily({source_id:brazil.id}), publisherFamily({source_id:southAfrica.id}));
});
test('RSS admission retains original credits, rejects ineligible entries, and caps unique recent stories', async () => {
  const url = brazil.homepage + 'educacao/noticia/';
  const entries = [entry('https://example.com/noticia/1'), entry(url+'wire','Agência parceira'), entry(url+'mixed','Reuters - Repórter da Agência Brasil'),
    entry(url+'missing',''), entry(brazil.homepage+'esportes/noticia/1'), entry(url+'no-date',byline,''),
    entry(url+'future',byline,'2026-11-28'), entry(url+'old',byline,'2026-11-01'), entry(url+'a'), entry(url+'a'),
    ...['b','c','d','e','f'].map(slug=>entry(url+slug))];
  const items = await rssItems(brazil, rss(entries), when, undefined, brazil);
  assert.deepEqual(items.map(i=>i.url), ['a','b','c','d'].map(id=>url+id));
  assert(items.every(i=>i.publication === brazil.name && i.authors?.[0] === byline && !i.owner_id && i.kind === 'article'));
  const za = await rssItems(southAfrica,rss([entry('https://other.example/x'),entry(southAfrica.homepage+'news/item','SAnews')]),when,undefined,southAfrica);
  assert.equal(za.length,1);
  assert.equal(za[0].publication,southAfrica.name);
  assert.equal(za[0].source_id,southAfrica.id);
  const personal = await rssItems({...brazil,id:'private-reader-feed'}, rss([entry('https://partner.example/story','External contributor','')]), when, 'reader');
  assert.equal(personal[0].owner_id,'reader');
  assert.equal(personal[0].authors?.[0],'External contributor');
  const email = newspaperEmail('Daily', [{...za[0],source_id:'eco',topic:'Portugal',tags:['Portugal','Education']}],when,'https://example.org/unsubscribe');
  assert.match(email,/Education · ECO/);
  assert.doesNotMatch(email,/Portugal · ECO/);
});
