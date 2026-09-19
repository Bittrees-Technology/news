#!/usr/bin/env python3
"""Report structural, timing and separately reviewed quality evidence. Never promote."""
import argparse,collections,json,pathlib,statistics

def summarize(rows,reviews=()):
    review_index={(r['model'],r['id']):r for r in reviews}
    reports=[]
    for model in sorted({r['model'] for r in rows}):
        subset=[r for r in rows if r['model']==model]
        times=sorted(r['seconds'] for r in subset if r.get('seconds') is not None)
        reviewed=[review_index[(model,r['id'])] for r in subset if (model,r['id']) in review_index]
        failed=[r for r in reviewed if r.get('verdict')=='fail']
        reports.append({'model':model,'completed':len(subset),'valid':sum(bool(r['valid']) for r in subset),
            'structural_valid_percent':round(100*sum(bool(r['valid']) for r in subset)/len(subset),2),
            'timed_cases':len(times),'untimed_cases':len(subset)-len(times),
            'latency_scope':'timed attempts only; excludes untimed errors and busy deferrals',
            'median_seconds':round(statistics.median(times),2) if times else None,
            'p95_seconds':times[min(len(times)-1,int(len(times)*.95))] if times else None,
            'errors':dict(collections.Counter(r.get('error','invalid-output') for r in subset if not r['valid'])),
            'quality_reviewed':len(reviewed),'quality_failed':len(failed),
            'factual_review_pending':len(subset)-len(reviewed),
            'quality_gate':'failed' if failed else 'not approved',
            'production_approved':False})
    return reports

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('results');p.add_argument('--reviews');args=p.parse_args()
    rows=[json.loads(x) for x in pathlib.Path(args.results).read_text().splitlines()]
    reviews=json.loads(pathlib.Path(args.reviews).read_text()) if args.reviews else []
    for report in summarize(rows,reviews):print(json.dumps(report))
