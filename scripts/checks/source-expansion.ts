import {fetchSource} from '../../lib/collect';
import {writeFileSync} from 'node:fs';
const candidates=[
['africanews','Africanews','https://www.africanews.com/feed/rss','World'],
['dw-world','DW World','https://rss.dw.com/rdf/rss-en-world','World'],
['france24','France 24 English','https://www.france24.com/en/rss','World'],
['rnz-world','RNZ World','https://www.rnz.co.nz/rss/world.xml','World'],
['rnz-pacific','RNZ Pacific','https://www.rnz.co.nz/rss/pacific.xml','World'],
['global-voices','Global Voices','https://globalvoices.org/feed/','World'],
['dialogue-earth','Dialogue Earth','https://dialogue.earth/en/feed/','Climate'],
['mongabay','Mongabay','https://news.mongabay.com/feed/','Climate'],
['bis-research','BIS Research','https://www.bis.org/doclist/research.rss','Economy'],
['bis-statistics','BIS Statistics Releases','https://data.bis.org/feed.xml','Economy'],
['fed-press','Federal Reserve Press Releases','https://www.federalreserve.gov/feeds/press_all.xml','Economy'],
['bitcoin-core','Bitcoin Core Releases','https://bitcoincore.org/en/rss.xml','Bitcoin'],
['bitcoin-optech','Bitcoin Optech','https://bitcoinops.org/feed.xml','Bitcoin'],
['worldbank-trade-podcast','World Bank Trade Tips','https://feeds.captivate.fm/trade-tips-world-bank-group/','Economy'],
['cna-asia','CNA Asia','https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511','World'],
['rest-of-world','Rest of World','https://restofworld.org/feed/','Tech'],
];
const results:any[]=[];
for(let n=0;n<candidates.length;n+=4)await Promise.all(candidates.slice(n,n+4).map(async ([id,name,url,topic])=>{
 const s={id,name,url,homepage:new URL(url).origin+'/',topic,kind:'rss',type:id.includes('podcast')?'podcast':'article'};
 try{const items=await fetchSource(s);const dates=items.map(i=>i.published_at).sort();results.push({source:s,items:items.length,newest:dates.at(-1)});console.log(id,items.length,dates.at(-1));}
 catch(e){results.push({source:s,error:(e as Error).message});console.log(id,(e as Error).message)}
}));
writeFileSync('/tmp/tbn-source-probes.json',JSON.stringify(results,null,2));
