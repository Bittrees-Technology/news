#!/usr/bin/env python3
"""Summarize isolated results without auto-approving a model or publishing text."""
import argparse,json,pathlib,statistics
p=argparse.ArgumentParser();p.add_argument('results');args=p.parse_args()
rows=[json.loads(x) for x in pathlib.Path(args.results).read_text().splitlines()]
for model in sorted({r['model'] for r in rows}):
    subset=[r for r in rows if r['model']==model];times=sorted(r['seconds'] for r in subset if r.get('seconds') is not None)
    print(json.dumps({'model':model,'completed':len(subset),'valid':sum(bool(r['valid']) for r in subset),'median_seconds':round(statistics.median(times),2) if times else None,'p95_seconds':times[min(len(times)-1,int(len(times)*.95))] if times else None,'factual_review_pending':sum(r.get('human_review')=='pending' for r in subset),'production_approved':False}))
