"""One local inference at a time; cache successful calls by exact request content."""
import contextlib, fcntl, hashlib, json, logging, math, os, pathlib, time, urllib.request, urllib.error

from model_registry import read_registry,artifact_key

class ModelBusy(Exception):
    pass

@contextlib.contextmanager
def model_slot(state, priority):
    state.mkdir(parents=True, exist_ok=True)
    waiting = state / 'translation-waiting'
    if priority == 'translation':
        waiting.touch()
    elif waiting.exists() and time.time() - waiting.stat().st_mtime < 120:
        raise ModelBusy()
    with (state / 'inference.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ModelBusy()
        try:
            if priority == 'translation':
                waiting.unlink(missing_ok=True)
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)

def add_inference_timings(timings, result):
    if timings is None: return
    metrics=result.get('news_metrics',{})
    for source,stage in [('load_seconds','model_prepare'),('inference_seconds','inference_request')]:
        value=metrics.get(source)
        if isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value) and 0<=value<=10000:
            timings[stage]=timings.get(stage,0)+value*1000

def completion(config, state, data, priority, timeout=900, timings=None, validator=None):
    gateway=config.get('model_gateway')
    if gateway:
        registry=read_registry(config['model_registry'])
        name=registry['routes'].get(priority,registry['routes']['briefing'])
        model=registry['models'][name]
        data={**data,'model':name}
        key=artifact_key(model,priority,data)
        config['last_model_used']=name+' sha256:'+model['sha256'][:12]
    else:
        key=hashlib.sha256(json.dumps([2,config['model_url'],data],sort_keys=True).encode()).hexdigest()
    cache = state / 'inference-cache'
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / (key + '.json')
    if path.exists():
        logging.info('Inference cache hit task=%s', priority)
        start=time.monotonic()
        result=json.loads(path.read_text())
        if validator:
            try:validator(result['choices'][0]['message']['content'])
            except (ValueError,TypeError,KeyError):
                path.unlink(missing_ok=True)
                raise
        if timings is not None: timings['cache_read']=timings.get('cache_read',0)+(time.monotonic()-start)*1000
        # Cached news_metrics describe the original request, not this cache hit.
        return result
    with (contextlib.nullcontext() if gateway else model_slot(state, priority)):
        start = time.monotonic()
        req = urllib.request.Request((gateway or config['model_url'])+'/chat/completions', data=json.dumps(data).encode(), headers={'Content-Type':'application/json','X-News-Task':priority})
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r:result=json.load(r)
        except urllib.error.HTTPError as e:
            if e.code==503:raise ModelBusy()
            raise
        add_inference_timings(timings,result)
        if result['choices'][0].get('finish_reason') == 'length':
            raise ValueError('Truncated model output')
        if data.get('response_format'):
            json.loads(result['choices'][0]['message']['content'])
        if validator:validator(result['choices'][0]['message']['content'])
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(result)); os.replace(tmp, path)
        # Bound only disposable inference cache; published artifacts are stored separately.
        files=sorted(cache.glob('*.json'),key=lambda p:p.stat().st_mtime)
        for old in files:
            if len(files)>5000 or time.time()-old.stat().st_mtime>30*86400:
                old.unlink(missing_ok=True)
                if len(files)>5000:files=files[1:]
        logging.info('Inference complete task=%s seconds=%.1f tokens=%s', priority, time.monotonic()-start, result.get('usage',{}).get('completion_tokens'))
        return result
