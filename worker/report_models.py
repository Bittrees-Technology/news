#!/usr/bin/env python3
"""Bounded model-health relay. The supervisor and benchmark never read News credentials."""
import json,pathlib,time,urllib.request,socket
from telemetry_summary import summarize_events
home=pathlib.Path.home();state=home/'.local/state/bittrees-news'
def smtp_check(host):
    try:
        with socket.create_connection((host,25),timeout=5) as s:
            s.settimeout(5);ok=s.recv(1024).startswith(b'220 smtp.bittrees.org ');s.sendall(b'QUIT\r\n');return ok
    except OSError:return False
while True:
    try:
        rows=[json.loads(x) for x in (state/'model-events.jsonl').read_text().splitlines()[-1000:]] if (state/'model-events.jsonl').exists() else []
        with urllib.request.urlopen('http://127.0.0.1:8092/health',timeout=5) as r:health=json.load(r)
        cfg=json.loads((home/'.config/bittrees-news/editor.json').read_text())
        payload={'smtp_local':smtp_check('127.0.0.1'),'smtp_public_route':smtp_check('smtp.bittrees.org'),**summarize_events(rows),'managed_model':health.get('managed_model')}
        req=urllib.request.Request(cfg['site']+'/api/editor/telemetry',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+cfg['token']})
        with urllib.request.urlopen(req,timeout=30) as r:r.read()
    except Exception as e:print(type(e).__name__,flush=True)
    time.sleep(300)
