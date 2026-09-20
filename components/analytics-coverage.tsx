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
 <h3>Signed-in engagement — 30 days</h3><p>{data.engagement.impressions} article views · {data.engagement.clicks} source clicks · {data.engagement.readers} readers. One count per reader/article/day; a view requires at least half the card visible for one second.</p><p>View-to-source rate: {data.engagement.readers>=5 && data.engagement.impressions>=20 ? `${(100*data.engagement.clicks_after_view/data.engagement.impressions).toFixed(1)}%` : "Insufficient sample (minimum 5 readers and 20 views)"}. Guests are not collected.</p>
 <h3>Feed transfer since instrumentation</h3><p>{data.transport.checks||0} successful checks · {data.transport.not_modified||0} HTTP 304 responses · {((data.transport.bytes||0)/1048576).toFixed(1)} MB response bodies · {data.transport.parsed_items||0} parsed entries (includes repeats).</p>
 <h3>Reader feedback</h3><p>{data.feedback.votes} votes from {data.feedback.voters} signed-in readers in 30 days. Small samples should not be treated as broad consensus.</p>
 <h3>Delivery in the last 7 days</h3><ul>{data.deliveries.statuses.map(s=><li key={s.status}>{s.status}: {s.count}</li>)}</ul><p>“Sent” records provider acceptance; it does not confirm inbox receipt.</p><p>Signed event receiver: {data.webhookConfigured?"configured":"not configured"}. Provider dashboard registration and first real event must also be verified.</p><ul>{data.deliveryEvents.map(e=><li key={e.status}>{e.status}: {e.count}</li>)}</ul>{!data.deliveryEvents.length&&<p>No signed delivery events recorded in the last seven days.</p>}<p>SMTP check: {data.smtp?.updated_at && Date.now()-new Date(data.smtp.updated_at).getTime()<900000 ? `local ${data.smtp.local===true?"reachable":data.smtp.local===false?"failed":"unknown"}; public-address route ${data.smtp.public_route===true?"reachable":data.smtp.public_route===false?"failed":"unknown"}`:"stale or not reported"}. Probed from the mail host; this is not an independent WAN test or inbox confirmation.</p>
 </>}</section>
}
