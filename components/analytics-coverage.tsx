"use client";
import {useEffect,useState} from 'react';
import type {analyticsAudit} from '@/lib/analytics-audit';
import {sourceName} from '@/lib/catalog';
export function AnalyticsCoverage(){
 const [data,setData]=useState<Awaited<ReturnType<typeof analyticsAudit>>|null>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/staff/analytics',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Analytics coverage unavailable');return r.json()}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[]);
 return <section className="panel"><h2>Coverage and engagement</h2>{error&&<p role="alert">{error}</p>}{!data&&!error&&<p>Loading coverage…</p>}{data&&<>
 <p>Snapshot: {new Date(data.at).toLocaleString()} · {data.catalogSize} available sources</p>
 <p>{data.coverage.total} public items: {data.coverage.articles} articles, {data.coverage.podcasts} podcasts and {data.coverage.data} data items.</p>
 <p>{data.coverage.briefings} generated briefings · {data.coverage.archived} archived. Briefings use available source evidence; these counts do not establish full-text coverage or factual accuracy.</p>
 <h3>Intake in the last 24 hours</h3><p>{data.recent.total} items from {data.recent.activeSources} sources. Largest source share: {data.recent.topSourceShare===null?'No recent items':`${(data.recent.topSourceShare*100).toFixed(1)}%`}.</p>
 <p>Measured by publication date. Intake volume is not reader popularity or front-page exposure.</p>
 <ul>{data.recent.sources.map(s=><li key={s.source_id}>{sourceName(s.source_id)}: {s.items}</li>)}</ul>
 <details><summary>Feed availability — 30-day samples</summary><p>This measures collection success, not editorial reliability. Editorial reliability is not yet rated. Excerpt matching and metadata completeness are automated heuristics, not fact checks.</p><ul>{data.availability.map(s=><li key={s.source_id}>{sourceName(s.source_id)}: {s.availability}% · {s.samples} checks</li>)}</ul></details>
 <h3>Ranking diversity experiment</h3><p>Shadow only: {data.shadow.editions} edition comparisons since {data.shadow.started_at ? new Date(data.shadow.started_at).toLocaleString() : "not started"}. Evaluate after seven days; live rankings are unchanged.</p>
 <h3>Reader feedback</h3><p>{data.feedback.votes} votes from {data.feedback.voters} signed-in readers in 30 days. Small samples should not be treated as broad consensus.</p>
 <h3>Delivery in the last 7 days</h3><ul>{data.deliveries.statuses.map(s=><li key={s.status}>{s.status}: {s.count}</li>)}</ul><p>“Sent” records provider acceptance; it does not confirm inbox receipt.</p>
 </>}</section>
}
