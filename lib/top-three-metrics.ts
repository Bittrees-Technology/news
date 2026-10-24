import {pool,tx} from './db';
import {hourlyTopCandidates} from './top-three-public';
import {selectTopThree,globalEdition,topThreeVersion} from './top-three';
export async function recordTopThreeMetrics(at=new Date()){
 const hour=new Date(Math.floor(+at/3600000)*3600000);
 return tx(async d=>{
  if(!(await d.query("SELECT pg_try_advisory_xact_lock(hashtext('top-three-hourly')) locked")).rows[0].locked)return;
  if((await d.query("SELECT 1 FROM ranking_history WHERE owner_key='public' AND kind='top-three-evaluation' AND bucket=$1 AND config->>'version'=$2 LIMIT 1",[hour,topThreeVersion])).rowCount)return;
  const candidates=await hourlyTopCandidates(hour.toISOString());
  const result=selectTopThree(candidates,globalEdition,hour);
  const engagement=(await d.query("SELECT count(*)::int events,count(DISTINCT account_id)::int readers FROM reader_events WHERE bucket>=(now() AT TIME ZONE 'UTC')::date-29")).rows[0];
  const feedback=(await d.query("SELECT count(*)::int votes,count(*) FILTER(WHERE value>0)::int positive,count(*) FILTER(WHERE value<0)::int negative,count(DISTINCT account_id)::int readers FROM article_feedback WHERE item_id=ANY($1::text[]) AND updated_at>now()-interval '30 days'",[result.items.map(i=>i.id)])).rows[0];
  const config={version:topThreeVersion,asOf:result.asOf,windowHours:24,policyWeights:{freshness:30,relevance:50,metadata:20},...result.metrics,
   selected:result.items.map((i,n)=>({id:i.id,position:n+1,score:i.ranking.value,factors:i.ranking.factors,source:i.source_id})),
   engagement:{windowDays:30,events:engagement.readers>=5?engagement.events:null,readers:engagement.readers>=5?engagement.readers:null},
   feedback:{windowDays:30,cohort:'selected stories; interest, not factual accuracy',votes:feedback.readers>=5?feedback.votes:null,positive:feedback.readers>=5?feedback.positive:null,negative:feedback.readers>=5?feedback.negative:null,readers:feedback.readers>=5?feedback.readers:null},
   factualAccuracy:null,cityMatchAccuracy:null,policy:'No automatic weight changes or model training. Review fixed-version samples and geography errors; compare seven-day windows before proposing changes. Unknown is not zero.'};
  await d.query("INSERT INTO ranking_history(owner_key,kind,entity_id,name,bucket,score,position,samples,config) VALUES('public','top-three-evaluation',$2,'Global top three',$1,0,1,$3,$4) ON CONFLICT DO NOTHING",[hour,'global:'+topThreeVersion,result.metrics.candidates,JSON.stringify(config)]);
 });
}
export async function topThreeEvaluation(){
 const rows=(await pool().query("SELECT bucket,config FROM ranking_history WHERE owner_key='public' AND kind='top-three-evaluation' AND config->>'version'=$1 AND bucket>now()-interval '7 days' ORDER BY bucket DESC LIMIT 168",[topThreeVersion])).rows;
 return {samples:rows.length,latest:rows[0]||null,days:7,automaticChanges:false};
}
