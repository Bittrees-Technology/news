"""One local inference at a time; cache successful calls by exact request content."""
import contextlib, fcntl, hashlib, json, logging, os, pathlib, time, urllib.request

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

def completion(config, state, data, priority, timeout=900):
    # Version, model endpoint, prompt and evidence all participate in invalidation.
    key = hashlib.sha256(json.dumps([2, config['model_url'], data], sort_keys=True).encode()).hexdigest()
    cache = state / 'inference-cache'
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / (key + '.json')
    if path.exists():
        logging.info('Inference cache hit task=%s', priority)
        return json.loads(path.read_text())
    with model_slot(state, priority):
        start = time.monotonic()
        req = urllib.request.Request(config['model_url']+'/chat/completions', data=json.dumps(data).encode(), headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            result = json.load(r)
        if result['choices'][0].get('finish_reason') == 'length':
            raise ValueError('Truncated model output')
        if data.get('response_format'):
            json.loads(result['choices'][0]['message']['content'])
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(result)); os.replace(tmp, path)
        logging.info('Inference complete task=%s seconds=%.1f tokens=%s', priority, time.monotonic()-start, result.get('usage',{}).get('completion_tokens'))
        return result
