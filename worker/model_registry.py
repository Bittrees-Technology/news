"""Versioned local model configuration. Never accepts paths/commands from a job."""
import hashlib,json,pathlib,re

def read_registry(path):
    r=json.loads(pathlib.Path(path).read_text())
    if r.get('version')!=1:raise ValueError('Unsupported registry version')
    for name,m in r['models'].items():
        if not re.fullmatch(r'[a-z0-9-]+',name):raise ValueError('Invalid model id')
        if not re.fullmatch(r'[a-f0-9]{64}',m['sha256']):raise ValueError('Model digest required')
        if not m['endpoint'].startswith('http://127.0.0.1:'):raise ValueError('Local endpoint required')
        if m.get('managed') and not pathlib.Path(m['path']).is_absolute():raise ValueError('Absolute model path required')
    for task,name in r['routes'].items():
        if name not in r['models'] or r['models'][name].get('status')!='approved':raise ValueError('Route must use an approved model')
    return r

def artifact_key(model,task,data):
    return hashlib.sha256(json.dumps({'version':3,'task':task,'model':model['sha256'],'quantization':model['quantization'],'prompt':model.get('prompt_version',1),'schema':model.get('schema_version',1),'request':data},sort_keys=True,ensure_ascii=False).encode()).hexdigest()
