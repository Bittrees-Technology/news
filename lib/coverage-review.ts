import {createHash} from 'node:crypto';
import {geographyFor,locationEvidence} from './geography';
import {publisherFamily,sameEvent} from './diversity-shadow';
import type {Item} from './model';
import {subjectEvidence} from './story-subjects';

export function articleRevision(item:Item) {
  const fields=[item.id,item.source_id,item.url,item.title,item.excerpt,item.source_context||'',item.authors||[],new Date(item.published_at).toISOString()];
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

// Private editorial metadata. Unknown origin and incident time stay unassigned.
export function articleAnnotations(item:Item) {
  const sourceText=item.title+' '+item.excerpt;
  const credit=(item.authors||[]).find(name=>/^(?:Reuters|Associated Press|Agence France-Presse|Lusa)$/i.test(name));
  const evidence={...item,summary:''};
  const places=locationEvidence(item);
  return {version:1,revision:articleRevision(item),subjects:subjectEvidence(item),
    mentionedCountries:geographyFor(evidence).countries, primaryCountry:places.length===1?places[0].country:null,placeEvidence:places,
    namedInHeadline:[...new Set(item.title.match(/\b(?:[A-ZÀ-Ý][\p{L}'’-]+(?:\s+[A-ZÀ-Ý][\p{L}'’-]+){1,3}|[A-Z]{3,8})\b/gu)||[])],
    reportType:/^(?:opinion|editorial|opinião)\s*[:|–-]/iu.test(item.title)?'commentary':'unknown',
    update:/\b(?:restored|restabelecid[oa]|reabertura|reopened)\b/iu.test(sourceText)?'possible-restoration':null,
    reportingOrigin:credit||null,eventTime:null};
}

export function coverageCandidates(input:Item[]) {
  const rows=input.filter(i=>!i.owner_id&&i.kind==='article').slice(0,200)
    .map(item=>({item,facets:articleAnnotations(item),family:publisherFamily(item)}));
  const pairs=[];
  for(let a=0;a<rows.length;a++) for(let b=a+1;b<rows.length;b++) {
    const first=rows[a],second=rows[b];
    if(first.family===second.family||Math.abs(+new Date(first.item.published_at)- +new Date(second.item.published_at))>36*3600000)continue;
    const sharedNames=first.facets.namedInHeadline.filter(name=>second.facets.namedInHeadline.includes(name));
    const sharedTopics=first.facets.subjects.filter(s=>second.facets.subjects.some(t=>t.id===s.id));
    if(!sameEvent(first.item,second.item)&&!(sharedNames.length&&sharedTopics.length))continue;
    pairs.push({first:first.item.id,second:second.item.id,sharedNames,subjects:sharedTopics.map(s=>s.id)});
    if(pairs.length===100)return pairs;
  }
  return pairs;
}
