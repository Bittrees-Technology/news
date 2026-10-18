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
