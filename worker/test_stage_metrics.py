import unittest,json
from unittest.mock import patch,MagicMock
from stage_metrics import report
class StageBatch(unittest.TestCase):
 def test_one_request_for_all_stages(self):
  with patch('stage_metrics.urllib.request.urlopen',return_value=MagicMock()) as request:
   report({'site':'https://example.org','token':'fixture'},{'item_id':'a'*64,'lease':'test'},'briefing',{'queue':1,'generation':2,'validation':3,'persist':4,'archive':5,'model_prepare':6,'inference_request':7,'cache_read':8,'secret':'excluded'})
   self.assertEqual(request.call_count,1)
   body=json.loads(request.call_args.args[0].data)
   self.assertEqual(len(body['metrics']),8);self.assertNotIn('secret',str(body))
 def test_invalid_and_empty_measurements_do_not_send(self):
  with patch('stage_metrics.urllib.request.urlopen') as request:
   report({}, {}, 'briefing',{'queue':None,'generation':float('nan'),'archive':True})
   request.assert_not_called()
