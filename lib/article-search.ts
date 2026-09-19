import type {Item} from './model';
export type SearchField = 'all' | 'title' | 'summary';
const normalize = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
export function matchesArticleSearch(item:Pick<Item,'title'|'summary'|'excerpt'|'translation'|'briefing_preview'>,query:string,field:SearchField='all') {
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 if(!terms.length)return true;
 const titles=[item.title,item.translation?.title];
 const summaries=[item.briefing_preview,item.translation?.briefing_preview,item.translation?.summary,item.summary,item.excerpt];
 const text=normalize((field==='title'?titles:field==='summary'?summaries:[...titles,...summaries]).filter(Boolean).join(' '));
 return terms.every(term=>text.includes(term));
}
