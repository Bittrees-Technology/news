import json,pathlib,tempfile,unittest
from unittest.mock import patch,MagicMock
from model_runtime import completion,add_inference_timings

class InferenceTimingTests(unittest.TestCase):
    def test_multiple_calls_sum_only_valid_measured_stages(self):
        timings={}
        result={'news_metrics':{'load_seconds':2,'inference_seconds':3}}
        add_inference_timings(timings,result);add_inference_timings(timings,result)
        self.assertEqual(timings,{'model_prepare':4000,'inference_request':6000})
        for bad in [None,True,-1,float('nan'),float('inf'),'text',10001]:
            add_inference_timings(timings,{'news_metrics':{'load_seconds':bad}})
        self.assertEqual(timings['model_prepare'],4000)
        add_inference_timings(timings,{})
        self.assertNotIn('cache_read',timings)
    def test_cache_hit_does_not_replay_historical_inference_cost(self):
        with tempfile.TemporaryDirectory() as d:
            state=pathlib.Path(d)
            config={'model_gateway':'http://local/v1','model_registry':'fixture'}
            registry={'routes':{'briefing':'test'},'models':{'test':{'sha256':'a'*64,'quantization':'Q4','prompt_version':1,'schema_version':1}}}
            result={'choices':[{'message':{'content':'ok'},'finish_reason':'stop'}],'news_metrics':{'load_seconds':1,'inference_seconds':2}}
            response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps(result).encode()
            with patch('model_runtime.read_registry',return_value=registry),patch('model_runtime.urllib.request.urlopen',return_value=response) as request:
                live={};completion(config,state,{},'briefing',timings=live)
                cached={};completion(config,state,{},'briefing',timings=cached)
                self.assertEqual(request.call_count,1)
                self.assertEqual(live,{'model_prepare':1000,'inference_request':2000})
                self.assertEqual(set(cached),{'cache_read'})
                self.assertGreaterEqual(cached['cache_read'],0)
