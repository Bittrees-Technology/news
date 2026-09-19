#!/usr/bin/env python3
"""Outbound-only public-news editor. Holds no account, database or mail authority."""
import json,os,time,pathlib,urllib.request,logging,fcntl,re
logging.basicConfig(level=logging.INFO,format='%(asctime)s %(message)s')
config=json.loads(pathlib.Path(os.environ.get('NEWS_EDITOR_CONFIG',str(pathlib.Path.home()/'.config/bittrees-news/editor.json'))).read_text())
state=pathlib.Path.home()/'.local/state/bittrees-news';state.mkdir(parents=True,exist_ok=True)
lock=open(state/'editor.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def api(path,data):
 req=urllib.request.Request(config['site']+'/api/editor/'+path,data=json.dumps(data).encode(),headers={'Authorization':'Bearer '+config['token'],'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
from excerpt_selection import select_excerpt
while True:
 try:
  job=api('claim',{})
  if not job:time.sleep(25);continue
  file=state/(job['id'].replace(':','-')+'-grounded.json')
  saved=json.loads(file.read_text()) if file.exists() else {'stories':[]}
  # Respect server ranking and discard checkpoints that no longer match evidence.
  chosen=job['items'][:24]
  by_id={i['id']:i for i in chosen}
  saved['stories']=[s for s in saved['stories'] if s['id'] in by_id and ' '.join(s['summary'].split()) in ' '.join((by_id[s['id']].get('excerpt') or by_id[s['id']]['title']).split())]
  done={i['id'] for i in saved['stories']}
  for i in chosen:
   if i['id'] in done:continue
   text=select_excerpt(i)
   if len(text)<10:continue
   # Only exact source spans can be published. Normalize whitespace only.
   saved['stories'].append({'id':i['id'],'summary':text});file.write_text(json.dumps(saved));logging.info('Prepared story %s of %s',len(saved['stories']),len(chosen))
  brief='The Bittrees News desk selected '+str(len(saved['stories']))+' source-linked stories across '+', '.join(dict.fromkeys(i['topic'] for i in chosen))+'. Summaries retain source wording; follow each link for the full report.'
  api('result',{'id':job['id'],'stories':saved['stories'],'brief':brief,'model':'Bittrees grounded excerpt selector v2'})
  logging.info('Edition completed %s',job['id'])
 except Exception as e:
  logging.warning('Editor operation failed: %s',type(e).__name__)
  time.sleep(60)
