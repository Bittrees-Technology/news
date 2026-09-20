"""Separate explicitly identified production calls from experiments/legacy rows."""
import datetime, math, statistics

def summarize_events(rows):
    rows=rows[-1000:]
    production=[r for r in rows if r.get('mode')=='production']
    good=[r for r in production if r.get('ok') is True]
    times=[r['inference_seconds'] for r in good if isinstance(r.get('inference_seconds'),(int,float)) and math.isfinite(r['inference_seconds']) and 0<=r['inference_seconds']<=10000]
    dates=[r['at'] for r in rows if isinstance(r.get('at'),(int,float)) and math.isfinite(r['at']) and 0<=r['at']<=253402300799]
    def iso(value):
        return datetime.datetime.fromtimestamp(value,datetime.timezone.utc).isoformat().replace('+00:00','Z')
    return {'completed':len(good),'failed':sum(r.get('ok') is False for r in production),
            'median_seconds':round(statistics.median(times),2) if times else None,
            'event_samples':len(rows),'benchmark_samples':sum(r.get('mode')=='benchmark' for r in rows),
            'unknown_samples':sum(r.get('mode') not in ('production','benchmark') for r in rows),
            'sample_start':iso(min(dates)) if dates else None,'sample_end':iso(max(dates)) if dates else None}
