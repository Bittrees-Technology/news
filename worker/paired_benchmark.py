"""Compare frozen evidence and reviewed output revisions. No model or publication access."""
import argparse
import hashlib
import json
import math
import pathlib
import statistics

def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def paired_report(baseline,candidate,reviews):
    def index(rows):
        result={}
        for row in rows:
            key=(row['id'],row['evidence_hash'])
            if key in result: raise ValueError('Duplicate case within one run')
            result[key]=row
        return result
    before,after=index(baseline),index(candidate)
    keys=sorted(before.keys() & after.keys())
    verdicts={(r['output_hash'],r['evidence_hash']):r['verdict'] for r in reviews}
    times=[[],[]]
    reviewed=[0,0]
    passed=[0,0]
    structural=[0,0]
    for key in keys:
        for n,row in enumerate([before[key],after[key]]):
            structural[n]+=row.get('valid') is True
            verdict=verdicts.get((row.get('output_hash'),row['evidence_hash']))
            reviewed[n]+=verdict in ('pass','fail')
            passed[n]+=verdict=='pass'
        pair=[before[key].get('seconds'),after[key].get('seconds')]
        if all(type(x) in (int,float) and math.isfinite(x) and x>0 for x in pair) and all(r.get('valid') for r in [before[key],after[key]]):
            for n in (0,1):times[n].append(pair[n])
    latency=[{'median':statistics.median(t),'p95':sorted(t)[math.ceil(.95*len(t))-1]} if t else None for t in times]
    complete=bool(keys) and len(keys)==len(before)==len(after)
    return {'matched':len(keys),'baseline_only':len(before)-len(keys),'candidate_only':len(after)-len(keys),
            'timed_pairs':len(times[0]),'latency_seconds':latency,'valid':structural,'reviewed':reviewed,'passed':passed,
            'quality_and_speed_improved_on_sample': (passed[1]>passed[0] and latency[1]['median']<latency[0]['median']
                and latency[1]['p95']<=latency[0]['p95']) if complete and min(reviewed)==len(keys) and len(times[0])==len(keys) else None,
            'production_approved':False}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for key in ['baseline','candidate','reviews']:p.add_argument(key,type=pathlib.Path)
    a=p.parse_args()
    read=lambda path:[json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    print(json.dumps(paired_report(read(a.baseline),read(a.candidate),read(a.reviews)),indent=2))
