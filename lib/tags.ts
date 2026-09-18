import type {Item} from './model';
export const addedTopics=['Bitcoin','Crypto','Politics','DAOs'];
export const normalizeTopic=(topic:string)=>topic==='Apple'?'Tech':topic==='Nintendo'?'Gaming':topic;
const rules:[string,RegExp][]=[
 ['Bitcoin',/\b(bitcoin|btc|lightning network|satoshi)\b/i],
 ['Crypto',/\b(bitcoin|crypto(?:currency|currencies)?|ethereum|blockchain|defi|web3|stablecoins?|tokeni[sz]ation)\b/i],
 ['Politics',/\b(politic\w*|elections?|parliament|congress|senate|government|president|legislation|geopolitic\w*)\b/i],
 ['DAOs',/\b(daos?|decentralized autonomous organi[sz]ations?)\b/i],
];
export function articleTags(i:Pick<Item,'topic'|'title'|'excerpt'|'summary'|'tags'|'translation'>){
 const text=[i.title,i.excerpt,i.summary,i.translation?.title,i.translation?.summary].filter(Boolean).join(' ');
 return [...new Set([normalizeTopic(i.topic),...(i.tags||[]).map(normalizeTopic),...rules.filter(([,re])=>re.test(text)).map(([tag])=>tag)])].filter(Boolean);
}
export function tagStyle(tag:string){
 const fixed:Record<string,number>={Bitcoin:32,Crypto:270,Politics:205,DAOs:155,Tech:215,Science:175,Gaming:320};
 const hue=fixed[tag]??[...tag].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,0);
 return {backgroundColor:`hsl(${hue} 52% 92%)`,color:`hsl(${hue} 65% 24%)`,borderColor:`hsl(${hue} 38% 68%)`};
}
