import json, pathlib, tempfile, unittest, urllib.error
from unittest.mock import Mock, patch
from briefing_recovery import PendingWrite, Backoff, transient, model_ready
from model_supervisor import Supervisor

def http(code):return urllib.error.HTTPError('http://fixture',code,'fixture',{},None)
class Recovery(unittest.TestCase):
 def test_database_outage_survives_worker_restart(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/'pending.json';send=Mock(side_effect=http(503))
   with self.assertRaises(urllib.error.HTTPError):PendingWrite(path,send).save('result',{'id':'public','briefing':{'overview':'validated output'}})
   self.assertTrue(path.exists());self.assertEqual(path.stat().st_mode&0o777,0o600)
   recovered=Mock(return_value={'ok':True})
   PendingWrite(path,recovered).flush()
   recovered.assert_called_once_with('result',{'id':'public','briefing':{'overview':'validated output'}})
   self.assertFalse(path.exists())
 def test_ambiguous_committed_write_and_expired_lease(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/'pending.json'
   self.assertIsNone(PendingWrite(path,Mock(side_effect=http(409))).save('result',{}))
   self.assertFalse(path.exists())
 def test_validation_rejection_does_not_block_queue(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/'pending.json'
   with self.assertRaises(urllib.error.HTTPError):PendingWrite(path,Mock(side_effect=http(400))).save('result',{})
   self.assertFalse(path.exists())
 def test_auth_failure_is_not_bypassed(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/'pending.json'
   with self.assertRaises(urllib.error.HTTPError):PendingWrite(path,Mock(side_effect=http(401))).save('result',{})
   self.assertTrue(path.exists())
 def test_transient_and_quality_are_distinct(self):
  for e in [http(429),http(502),http(503),TimeoutError(),urllib.error.URLError('offline')]:self.assertTrue(transient(e))
  for e in [http(400),http(401),ValueError('bad content')]:self.assertFalse(transient(e))
 def test_capped_backoff_recovers(self):
  b=Backoff();self.assertEqual([b.delay() for _ in range(7)],[30,60,120,240,300,300,300]);b.reset();self.assertEqual(b.delay(),30)
 def test_model_probe_recovers(self):
  response=Mock();response.__enter__=Mock(return_value=Mock(status=200));response.__exit__=Mock()
  with patch('briefing_recovery.urllib.request.urlopen',side_effect=[http(503),response]):
   with self.assertRaises(urllib.error.HTTPError):model_ready({'model_gateway':'http://localhost/v1'})
   self.assertTrue(model_ready({'model_gateway':'http://localhost/v1'}))
 def test_failed_managed_child_unloaded_then_next_request_succeeds(self):
  with tempfile.TemporaryDirectory() as folder:
   s=Supervisor('fixture',pathlib.Path(folder));s.prepare=Mock();s.unload=Mock();s.event=Mock()
   registry={'models':{'fixture':{'managed':True,'status':'approved','endpoint':'http://fixture','max_tokens':400,'sha256':'test'}}}
   response=Mock();response.__enter__=Mock(return_value=Mock(read=Mock(return_value=json.dumps({'choices':[{'finish_reason':'stop'}]}).encode())));response.__exit__=Mock()
   with patch('model_supervisor.read_registry',return_value=registry),patch('model_supervisor.urllib.request.urlopen',side_effect=[TimeoutError(),response]):
    with self.assertRaises(TimeoutError):s.run({'model':'fixture'},'production','briefing')
    s.unload.assert_called_once()
    self.assertEqual(s.run({'model':'fixture'},'production','briefing')['choices'][0]['finish_reason'],'stop')
 def test_real_worker_loop_resumes_model_and_database_outages(self):
  import runpy, io
  class Finished(Exception):pass
  with tempfile.TemporaryDirectory() as folder:
   home=pathlib.Path(folder);cfg=home/'.config/bittrees-news';cfg.mkdir(parents=True)
   (cfg/'editor.json').write_text(json.dumps({'site':'http://fixture','token':'fixture','model_url':'http://model/v1','model':'fixture'}))
   briefing={'overview':'The study enrolled 120 adults during 2025 and reported results for the specified observation period.', 'points':['The study enrolled 120 adults during 2025.'],'context':'The reported study examined adults during 2025.','limitations':'Long-term outcomes were not supplied in the source.'}
   job={'item_id':'a'*64,'lease':'fixture','kind':'article','source_id':'fixture','title':'A study','published_at':'2026-01-01','excerpt':'A study enrolled 120 adults during 2025.'}
   events=[];claims=0;writes=0;finished=False
   def request(req,**kw):
    nonlocal claims,writes,finished
    route=req.full_url.rsplit('/',1)[-1];events.append(route)
    if route=='claim':
     claims+=1
     if claims==1:value=job
     else:finished=True;value=None
    elif route=='result':
     writes+=1
     if writes==1:raise http(503)
     value={'briefing':briefing}
    else:raise AssertionError(route)
    return io.BytesIO(json.dumps(value).encode())
   def sleep(_):
    if finished:raise Finished()
   with patch('pathlib.Path.home',return_value=home),patch('sys.argv',['stories.py']),patch('briefing_recovery.model_ready',side_effect=[urllib.error.URLError('offline'),True,True]),patch('model_runtime.completion',return_value={'choices':[{'message':{'content':json.dumps(briefing)}}]}),patch('urllib.request.urlopen',side_effect=request),patch('time.sleep',side_effect=sleep):
    with self.assertRaises(Finished):runpy.run_path(str(pathlib.Path(__file__).with_name('stories.py')),run_name='__main__')
   self.assertEqual(events,['claim','result','result','claim'])
   self.assertFalse((home/'.local/state/bittrees-news/generation-pending.json').exists())
