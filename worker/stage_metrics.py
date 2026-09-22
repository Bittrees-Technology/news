"""Best-effort bounded timing batch; no source text or credentials."""
import json, math, urllib.request

STAGES={'queue','generation','validation','archive','persist','model_prepare','inference_request','cache_read'}

def report(config, job, task, timings):
    metrics=[{'stage':stage,'milliseconds':max(0,min(90*86400000,value))}
             for stage,value in timings.items() if stage in STAGES
             and isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)]
    if not metrics:return
    try:
        payload={'task':task,'id':job.get('item_id',job.get('key')),'lease':job['lease'],'metrics':metrics}
        req=urllib.request.Request(config['site']+'/api/editor/metrics',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+config['token'],'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=10) as response:response.read()
    except Exception:pass
