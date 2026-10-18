import io,json,pathlib,tempfile,threading,time,unittest
from unittest.mock import patch,MagicMock
from model_supervisor import Supervisor
from model_runtime import ModelBusy
class ReviewPriority(unittest.TestCase):
 def test_stream_completed_without_reasoning(self):
  with tempfile.TemporaryDirectory() as folder:
   s=Supervisor('',pathlib.Path(folder)); response=MagicMock()
   response.__enter__.return_value=iter([b'data: {"choices":[{"delta":{"content":"Check missing authors."},"finish_reason":null}]}\n',b'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n',b'data: [DONE]\n'])
   with patch('model_supervisor.urllib.request.urlopen',return_value=response) as call:
    result=s.review_completion({'endpoint':'http://fixture/v1'},{'max_tokens':500})
   self.assertEqual(result['choices'][0]['message']['content'],'Check missing authors.')
   request=json.loads(call.call_args.args[0].data);self.assertEqual(request['max_tokens'],192);self.assertFalse(request['chat_template_kwargs']['enable_thinking']);response.__exit__.assert_called_once()
 def test_foreground_cancels_review_and_closes_upstream(self):
  with tempfile.TemporaryDirectory() as folder:
   s=Supervisor('',pathlib.Path(folder));s.review_preempt.set();response=MagicMock();response.__enter__.return_value=iter([b'data: {}\n'])
   with patch('model_supervisor.urllib.request.urlopen',return_value=response):
    with self.assertRaises(ModelBusy):s.review_completion({'endpoint':'http://fixture/v1'},{})
   response.__exit__.assert_called_once()
 def test_foreground_sets_preempt_before_waiting_for_slot(self):
  with tempfile.TemporaryDirectory() as folder:
   s=Supervisor('',pathlib.Path(folder));s.review_active=True;s.mutex.acquire();observed=[]
   def release():
    observed.append(s.review_preempt.wait(1));s.mutex.release()
   thread=threading.Thread(target=release);thread.start()
   with patch('model_supervisor.read_registry',return_value={'models':{'m':{'status':'approved','managed':False}}}),patch.object(s,'prepare',side_effect=ValueError('fixture reached foreground')):
    with self.assertRaisesRegex(ValueError,'fixture reached'):s.run({'model':'m'},'production','briefing')
   thread.join();self.assertEqual(observed,[True]);self.assertFalse(s.mutex.locked())
 def test_real_http_stream_yields_and_foreground_completes(self):
  from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
  started=threading.Event();closed=threading.Event()
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
    self.send_response(200);self.end_headers()
    if body.get('stream'):
     started.set()
     try:
      for _ in range(100):
       self.wfile.write(b'data: {"choices":[{"delta":{"content":"1"}}]}\n\n');self.wfile.flush();time.sleep(.01)
     except (BrokenPipeError,ConnectionResetError):closed.set()
    else:self.wfile.write(b'{"choices":[{"finish_reason":"stop","message":{"content":"foreground completed"}}]}')
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True
  listener=threading.Thread(target=server.serve_forever,daemon=True);listener.start()
  try:
   with tempfile.TemporaryDirectory() as folder:
    s=Supervisor('',pathlib.Path(folder));s.prepare=MagicMock();outcomes=[]
    registry={'models':{'m':{'status':'approved','managed':False,'max_tokens':192,'sha256':'a'*64,'endpoint':f'http://127.0.0.1:{server.server_port}/v1'}}}
    def review():
     try:s.run({'model':'m'},'production','daily-report')
     except ModelBusy:outcomes.append('yielded')
    with patch('model_supervisor.read_registry',return_value=registry):
     t=threading.Thread(target=review);t.start();self.assertTrue(started.wait(2))
     result=s.run({'model':'m'},'production','briefing');t.join(2)
    self.assertEqual(outcomes,['yielded']);self.assertEqual(result['choices'][0]['message']['content'],'foreground completed');self.assertTrue(closed.wait(2));self.assertFalse(s.mutex.locked())
  finally:server.shutdown();server.server_close();listener.join()
