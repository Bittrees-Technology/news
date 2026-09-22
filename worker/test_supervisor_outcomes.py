import contextlib,json,pathlib,tempfile,unittest
from unittest.mock import patch,MagicMock
from model_supervisor import Supervisor
class Outcomes(unittest.TestCase):
 def exercise(self,response=None,error=None):
  with tempfile.TemporaryDirectory() as folder:
   s=Supervisor('fixture',pathlib.Path(folder));s.prepare=MagicMock();s.event=MagicMock()
   registry={'models':{'model':{'status':'approved','managed':False,'endpoint':'http://fixture/v1','max_tokens':320,'sha256':'a'*64}}}
   remote=MagicMock();remote.__enter__.return_value.read.return_value=json.dumps(response).encode()
   with patch('model_supervisor.read_registry',return_value=registry),patch('model_supervisor.model_slot',return_value=contextlib.nullcontext()),patch('model_supervisor.time.monotonic',side_effect=[10,12,17]),patch('model_supervisor.urllib.request.urlopen',side_effect=error,return_value=remote):
    if error:
     with self.assertRaises(type(error)):s.run({'model':'model'},'production','briefing')
    else:s.run({'model':'model'},'production','briefing')
   self.assertFalse(s.mutex.locked())
   return s.event.call_args.args[0]
 def test_truncation_measured_but_not_complete(self):
  e=self.exercise({'choices':[{'finish_reason':'length','message':{'content':'secret source content'}}]})
  self.assertTrue(e['ok']);self.assertFalse(e['output_complete']);self.assertEqual(e['finish_reason'],'length')
  self.assertEqual((e['load_seconds'],e['inference_seconds'],e['elapsed_seconds']),(2,5,7))
  self.assertNotIn('secret',json.dumps(e))
 def test_transport_failure_retains_elapsed_time(self):
  e=self.exercise(error=ConnectionError('secret endpoint'))
  self.assertFalse(e['ok']);self.assertEqual(e['elapsed_seconds'],7);self.assertEqual(e['inference_seconds'],5)
  self.assertNotIn('secret',json.dumps(e))
 def test_stop_and_unknown_are_distinct(self):
  self.assertTrue(self.exercise({'choices':[{'finish_reason':'stop'}]})['output_complete'])
  e=self.exercise({'choices':[{'finish_reason':'untrusted secret'}]})
  self.assertEqual(e['finish_reason'],'unknown');self.assertIsNone(e['output_complete'])
