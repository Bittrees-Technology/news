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
 const fixed:Record<string,number>={Bitcoin:32,Crypto:265,Blockchain:265,DAOs:160,Governance:160,Politics:210,World:210,Economy:32,Tech:220,AI:220,Security:220,Science:175,Quantum:175,Space:175,Health:150,Biotech:150,Climate:145,Energy:145,Nuclear:145,Gaming:315};
 const palette=[32,145,175,210,265,315];
 const hue=fixed[tag]??palette[[...tag].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,0)%palette.length];
 return {backgroundColor:`hsl(${hue} var(--tag-bg))`,color:`hsl(${hue} var(--tag-ink))`,borderColor:`hsl(${hue} var(--tag-border))`};
}
