"""Rolling, content-free telemetry for the single briefing generation worker."""
from datetime import datetime, timezone, timedelta
import json
import math
import os
import pathlib
import tempfile
from collections import Counter

BOUNDS=(1,5,15,30,60,120,300,900)
VERSION='briefing-guards-v1'

def record(state, model, timings, signals, outcome, now=None):
    day=(now or datetime.now(timezone.utc)).date()
    path=state/'editorial-performance.json'
    history=json.loads(path.read_text()) if path.exists() else {}
    oldest=(day-timedelta(days=13)).isoformat()
    history={k:v for k,v in history.items() if oldest<=k<=day.isoformat()}
    cohorts=history.setdefault(day.isoformat(),{})
    key=VERSION+'/'+model[:120]
    group=cohorts.setdefault(key,{'outcomes':{},'signals':{},'cache_hits':0,'generation_seconds_histogram':{},'timed':0})
    group['outcomes'][outcome]=group['outcomes'].get(outcome,0)+1
    group['signals']=dict(Counter(group['signals'])+Counter(set(signals)))
    group['cache_hits']+=int('cache_read' in timings)
    value=timings.get('generation')
    if type(value) in (int,float) and math.isfinite(value) and value>=0:
        bucket=str(next((n for n in BOUNDS if value<=n*1000),'over_900'))
        group['generation_seconds_histogram'][bucket]=group['generation_seconds_histogram'].get(bucket,0)+1
        group['timed']+=1
    with tempfile.NamedTemporaryFile(mode='w',prefix='.editorial-',dir=state,delete=False) as f:
        try:
            json.dump(history,f,separators=(',',':'))
            f.flush()
            os.replace(f.name,path)
        finally:pathlib.Path(f.name).unlink(missing_ok=True)
