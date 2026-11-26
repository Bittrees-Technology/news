import {SourceCredit} from './source-credit';
import type {Coverage} from '@/lib/coverage';
export function CoverageCard({event}:{event:Coverage}) {
  return <>
    <h2>{event.title}</h2>
    {event.claims.map((claim,n)=><p key={n}>{claim.text}{' '}
      {claim.reports.map(id=>{
        const report=event.reports.find(r=>r.id===id)!;
        return <small key={id}> <a href={report.url} rel="noopener noreferrer">{report.outlet}</a></small>;
      })}
    </p>)}
    <details><summary>Coverage from {new Set(event.reports.map(r=>r.outlet)).size} sources</summary>
      <ul>{event.reports.map(r=><li key={r.id}><a href={r.url} rel="noopener noreferrer">{r.title}</a>
        {' · '}{r.outlet}{r.authors.length?' · '+r.authors.join(', '):''}{' · '}
        <time dateTime={r.publishedAt}>{r.publishedAt.slice(0,16).replace('T',' ')} UTC</time>{' · '}
        <a href={'/story/'+r.id}>Individual briefing</a>{' '}
        <SourceCredit sourceId={r.sourceId}/></li>)}</ul>
    </details>
  </>;
}
