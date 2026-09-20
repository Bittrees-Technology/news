"""Best-effort public-job timing; no source text or credentials in metrics."""
import json, urllib.request

def report(config, job, task, timings):
    for stage, milliseconds in timings.items():
        if milliseconds is None: continue
        try:
            payload={'task':task,'id':job.get('item_id',job.get('key')),'lease':job['lease'],'stage':stage,'milliseconds':max(0,min(90*86400000,milliseconds))}
            req=urllib.request.Request(config['site']+'/api/editor/metrics',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+config['token'],'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=10) as response: response.read()
        except Exception: pass
