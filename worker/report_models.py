#!/usr/bin/env python3
"""Bounded model-health relay. The supervisor and benchmark never read News credentials."""
import json,pathlib,statistics,time,urllib.request
home=pathlib.Path.home();state=home/'.local/state/bittrees-news'
while True:
    try:
        rows=[json.loads(x) for x in (state/'model-events.jsonl').read_text().splitlines()[-1000:]] if (state/'model-events.jsonl').exists() else []
        good=[r for r in rows if r.get('ok')];times=[r['inference_seconds'] for r in good]
        with urllib.request.urlopen('http://127.0.0.1:8092/health',timeout=5) as r:health=json.load(r)
        cfg=json.loads((home/'.config/bittrees-news/editor.json').read_text())
        payload={'completed':len(good),'failed':len(rows)-len(good),'median_seconds':round(statistics.median(times),2) if times else None,'managed_model':health.get('managed_model')}
        req=urllib.request.Request(cfg['site']+'/api/editor/telemetry',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+cfg['token']})
        with urllib.request.urlopen(req,timeout=30) as r:r.read()
    except Exception as e:print(type(e).__name__,flush=True)
    time.sleep(300)
