#!/usr/bin/env python3
"""Local-only model lifecycle/proxy. No News, database, email or IPFS credentials."""
import argparse,atexit,hashlib,json,os,pathlib,subprocess,threading,time,urllib.request,urllib.error,socketserver
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from model_registry import read_registry
from model_runtime import model_slot,ModelBusy

class Supervisor:
    def __init__(self,registry,state):
        self.registry=registry;self.state=state;self.process=None;self.loaded=None;self.last_used=0;self.mutex=threading.Lock();self.verified={}
    def unload(self):
        if self.process is not None:
            self.process.terminate()
            try:self.process.wait(timeout=20)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait()
            self.process=None;self.loaded=None
    def prepare(self,name,m,r):
        path=pathlib.Path(m['path']);stamp=(path.stat().st_size,path.stat().st_mtime_ns)
        if self.verified.get(name)!=stamp:
            with path.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
            if digest!=m['sha256']:raise ValueError('Model digest mismatch')
            self.verified[name]=stamp
        if not m.get('managed'):return
        if self.loaded==name and self.process.poll() is None:return
        self.unload()
        available=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
        if available < (r['reserve_mb']+m['memory_mb'])*1024**2:raise ModelBusy('Memory reserve')
        # Only spawn the pinned, locally configured executable; no shell command interpolation.
        port=int(m['endpoint'].split(':')[-1].split('/')[0])
        command=[r['executable'],'-m',m['path'],'--host','127.0.0.1','--port',str(port),'-c',str(m['context']),'-t','2','-np','1','--jinja']
        # Keep diagnostics inside the sandbox; opening /dev/null is intentionally denied.
        # Truncate for every load and cap server output by disabling routine logs.
        command+=['--log-disable']
        with (self.state/'model-startup.log').open('w') as log:
            self.process=subprocess.Popen(command,stdout=log,stderr=log,start_new_session=True)
        self.loaded=name
        deadline=time.monotonic()+120
        while time.monotonic()<deadline:
            if self.process.poll() is not None:raise RuntimeError('Model failed to start')
            try:
                with urllib.request.urlopen(m['endpoint'].removesuffix('/v1')+'/health',timeout=2) as q:
                    if q.status==200:return
            except Exception:time.sleep(.5)
        self.unload();raise TimeoutError('Model readiness timeout')
    def run(self,request,mode,task):
        r=read_registry(self.registry);name=request.get('model')
        if name not in r['models']:raise ValueError('Unknown model')
        m=r['models'][name]
        if mode!='benchmark' and m['status']!='approved':raise ValueError('Model is benchmark-only')
        if not self.mutex.acquire(blocking=False):raise ModelBusy()
        start=time.monotonic()
        try:
            with model_slot(self.state,task):
                self.prepare(name,m,r);loaded=time.monotonic()
                request={**request,'model':name,'max_tokens':min(request.get('max_tokens',320),m['max_tokens'])}
                req=urllib.request.Request(m['endpoint']+'/chat/completions',data=json.dumps(request).encode(),headers={'Content-Type':'application/json'})
                with urllib.request.urlopen(req,timeout=900) as response:result=json.load(response)
                self.last_used=time.monotonic()
                result['news_metrics']={'model_id':name,'digest':m['sha256'],'load_seconds':round(loaded-start,3),'inference_seconds':round(self.last_used-loaded,3),'mode':mode}
                self.event({'ok':True,'task':task,**result['news_metrics'],'tokens':result.get('usage',{}).get('completion_tokens',0)})
                return result
        except Exception as e:
            self.last_used=time.monotonic();self.event({'ok':False,'task':task,'model_id':name,'error':type(e).__name__});raise
        finally:self.mutex.release()
    def event(self,value):
        self.state.mkdir(parents=True,exist_ok=True)
        path=self.state/'model-events.jsonl'
        if path.exists() and path.stat().st_size>10_000_000:os.replace(path,self.state/'model-events.previous.jsonl')
        with path.open('a') as f:f.write(json.dumps({'at':time.time(),**value})+'\n')
    def reap(self):
        while True:
            time.sleep(15)
            if self.mutex.acquire(blocking=False):
                try:
                    if self.process and time.monotonic()-self.last_used>read_registry(self.registry)['idle_seconds']:self.unload()
                finally:self.mutex.release()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--registry',required=True);p.add_argument('--state',required=True);p.add_argument('--port',type=int,default=8092);args=p.parse_args()
    from filesystem_sandbox import restrict_files
    registry=read_registry(args.registry)
    pathlib.Path(args.state).mkdir(parents=True,exist_ok=True)
    restrict_files(['/usr','/lib','/lib64','/proc',pathlib.Path(__file__).parent,args.registry,pathlib.Path(registry['executable']).parent]+[m['path'] for m in registry['models'].values()], [args.state])
    supervisor=Supervisor(args.registry,pathlib.Path(args.state));atexit.register(supervisor.unload)
    threading.Thread(target=supervisor.reap,daemon=True).start()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def reply(self,status,value):
            body=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        def do_GET(self):
            if self.path=='/health':self.reply(200,{'ok':True,'managed_model':supervisor.loaded})
            else:self.reply(404,{'error':'Not found'})
        def do_POST(self):
            if self.path!='/v1/chat/completions':return self.reply(404,{'error':'Not found'})
            size=int(self.headers.get('Content-Length','0'))
            if size<1 or size>100000:return self.reply(400,{'error':'Invalid request size'})
            try:self.reply(200,supervisor.run(json.loads(self.rfile.read(size)),self.headers.get('X-News-Mode','production'),self.headers.get('X-News-Task','briefing')))
            except ModelBusy:self.reply(503,{'error':'Model busy or insufficient memory'})
            except Exception as e:self.reply(502,{'error':type(e).__name__})
    class UnixServer(socketserver.ThreadingMixIn,socketserver.UnixStreamServer):
        daemon_threads=True
    socket_path=pathlib.Path(args.state)/'model-gateway.sock'
    socket_path.unlink(missing_ok=True)
    unix_server=UnixServer(str(socket_path),Handler);socket_path.chmod(0o600)
    threading.Thread(target=unix_server.serve_forever,daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
