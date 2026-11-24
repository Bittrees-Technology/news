#!/usr/bin/env python3
"""Public briefings and local IPFS pinning; no private source or database access."""
import sys,json,os,time,pathlib,urllib.request,logging,fcntl
from briefing_recovery import PendingWrite, Backoff, transient, model_ready, watchdog
from stage_metrics import report
from archive_availability import archive_ready, defer_archive_error
from worker_cadence import briefing_delay
from briefing_quality import verify_source_job, briefing_request, evidence_review_signals, validate_briefing_content
from briefing_failure import failure_category, failure_label
from model_runtime import completion, ModelBusy
from editorial_metrics import record as record_editorial_metrics
logging.basicConfig(level=logging.INFO,format='%(asctime)s %(message)s')
config=json.loads((pathlib.Path.home()/'.config/bittrees-news/editor.json').read_text())
state=pathlib.Path.home()/'.local/state/bittrees-news';state.mkdir(parents=True,exist_ok=True)
archive_mode='--archive' in sys.argv
lock=open(state/('story-archive.lock' if archive_mode else 'stories.lock'),'w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def api(path,data):
 req=urllib.request.Request(config['site']+'/api/editor/story/'+path,data=json.dumps(data).encode(),headers={'Authorization':'Bearer '+config['token'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
def brief(j):
 global timings, review_signals
 verify_source_job(j)
 start=time.monotonic()
 if j['kind']=='data' and j['source_id'] in ('world-bank-gdp','defillama-protocols'):
  return {'overview':j['excerpt']+' This briefing describes a source-reported observation, rather than a prediction. Use the original dataset to examine definitions, historical series and revisions.', 'points':[j['title'],'The original source link identifies the dataset or protocol behind this observation.'],'context':'This is a source-reported data observation. Interpret it using the dataset definitions, reporting period and units supplied by the source.','limitations':'Values represent the reported period or retrieval snapshot. They may be revised and are not directly comparable without checking the source methodology.'}
 evidence=(j.get('source_context') or j.get('excerpt') or j['title'])[:6000]
 data=briefing_request(j,evidence,config['model'])
 out=completion(config,state,data,'briefing',timings=timings,validator=validate_briefing_content)['choices'][0]['message']['content']
 timings['generation']=(time.monotonic()-start)*1000
 start=time.monotonic()
 out=out.split('</think>')[-1].strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
 result=validate_briefing_content(out)
 signals=evidence_review_signals(j['title'],evidence,result)
 review_signals=signals
 if signals:
  logging.info('Briefing evidence review item=%s signals=%s',j['item_id'],','.join(signals))
 timings['validation']=(time.monotonic()-start)*1000
 return result
def pin(document):
 boundary='tbn-public-briefing-upload'
 content=json.dumps(document,ensure_ascii=False,sort_keys=True).encode()
 body=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="briefing.json"\r\nContent-Type: application/json\r\n\r\n').encode()+content+('\r\n--'+boundary+'--\r\n').encode()
 req=urllib.request.Request('http://127.0.0.1:5001/api/v0/add?pin=true&cid-version=1&raw-leaves=false',data=body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
 with urllib.request.urlopen(req,timeout=90) as r:return json.loads(r.read())['Hash']
from idle_polling import IdlePolling
idle_polling = IdlePolling(45, 60)
recovery = Backoff()
pending = PendingWrite(state / ("archive-pending.json" if archive_mode else "generation-pending.json"), api)
while True:
 review_signals=[];timings={}
 job=None;completed=False;phase="claim";delay=None
 try:
  watchdog()
  phase="persist";pending.flush()
  phase="claim"
  if not archive_mode and not model_ready(config):
   time.sleep(recovery.delay());continue
  if archive_mode and not archive_ready():
   logging.info('Local archive unavailable; waiting before claiming a briefing')
   time.sleep(60);continue
  job=api('claim',{'phase':'archive' if archive_mode else 'generation'})
  if not job:time.sleep(idle_polling.empty_delay());continue
  idle_polling.reset()
  timings={'queue':job.get('queue_wait_ms')}
  document=job.get('document')
  if not archive_mode:
   phase='generate';briefing=brief(job)
   phase='persist';document=pending.save('result',{'id':job['item_id'],'lease':job['lease'],'briefing':briefing,'release':True,'model':('Bittrees structured-data briefing' if job['kind']=='data' and job['source_id'] in ('world-bank-gdp','defillama-protocols') else 'Bittrees-hosted '+config.get('last_model_used',config['model']))})
   if document is None:continue
  if archive_mode:
   phase='archive';start=time.monotonic();cid=pin(document);timings['archive']=(time.monotonic()-start)*1000
   phase='pinned';start=time.monotonic();ack=pending.save('pinned',{'id':job['item_id'],'lease':job['lease'],'cid':cid});timings['persist']=(time.monotonic()-start)*1000
   if ack is None:continue
   logging.info('Public briefing archived %s %s',job['item_id'],cid)
  else:
   logging.info('Public briefing generated %s; archive queued independently',job['item_id'])
  if not archive_mode:
   try:record_editorial_metrics(state, 'structured' if job['kind']=='data' and job['source_id'] in ('world-bank-gdp','defillama-protocols') else config.get('last_model_used',config['model']), timings, review_signals, 'saved')
   except (OSError,ValueError,KeyError,TypeError):logging.warning('Local editorial telemetry unavailable')
  report(config,job,'briefing',timings)
  completed=True;recovery.reset()
 except Exception as e:
  logging.warning('Briefing worker retry: category=%s phase=%s type=%s status=%s',failure_category(e,phase),phase,type(e).__name__,getattr(e,'code','local'))
  if job and not archive_mode and phase=='generate' and not isinstance(e,ModelBusy):
   try:record_editorial_metrics(state,config.get('last_model_used',config['model']),timings,[],failure_category(e,phase))
   except (OSError,ValueError,KeyError,TypeError):logging.warning('Local editorial telemetry unavailable')
  delay=recovery.delay()
  if job and not pending.exists():
   try:pending.save('retry',{'id':job['item_id'],'lease':job['lease'],'busy':isinstance(e,ModelBusy) or transient(e) or defer_archive_error(e,phase),'error':failure_label(e,phase)})
   except Exception:pass
 time.sleep(delay if delay is not None else briefing_delay(completed,config.get('briefing_success_pause_seconds',5)))
