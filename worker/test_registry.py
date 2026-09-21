import copy,json,pathlib,tempfile,unittest,hashlib,contextlib
from unittest.mock import patch,MagicMock
from model_registry import read_registry,artifact_key
from model_supervisor import Supervisor
from model_runtime import ModelBusy
from telemetry_summary import summarize_events

class RegistryTests(unittest.TestCase):
    def test_cache_identity_changes_with_model_prompt_or_schema(self):
        m={'sha256':'a'*64,'quantization':'Q8','prompt_version':1,'schema_version':1}
        original=artifact_key(m,'briefing',{'text':'same'})
        for field,value in [('sha256','b'*64),('quantization','Q4'),('prompt_version',2),('schema_version',2)]:
            self.assertNotEqual(original,artifact_key({**m,field:value},'briefing',{'text':'same'}))
        self.assertNotEqual(original,artifact_key(m,'translation',{'text':'same'}))
    def test_registry_cannot_route_production_to_candidate(self):
        r=json.loads((pathlib.Path(__file__).parent/'models.example.json').read_text());r['routes']['briefing']='qwen3-06b'
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/'models.json';p.write_text(json.dumps(r))
            with self.assertRaises(ValueError):read_registry(p)
    def test_managed_launch_uses_sandbox_state_for_output(self):
        with tempfile.TemporaryDirectory() as d:
            state=pathlib.Path(d);model=state/'model.gguf';model.write_bytes(b'fixture')
            s=Supervisor(None,state)
            m={'path':str(model),'sha256':hashlib.sha256(b'fixture').hexdigest(),'managed':True,'endpoint':'http://127.0.0.1:8093/v1','context':4096,'memory_mb':0}
            process=MagicMock();process.poll.return_value=None
            response=MagicMock();response.__enter__.return_value.status=200
            with patch('model_supervisor.subprocess.Popen',return_value=process) as launch, patch('model_supervisor.urllib.request.urlopen',return_value=response), patch('model_supervisor.pathlib.Path.read_text',return_value='MemAvailable: 9999999 kB'):
                s.prepare('test',m,{'reserve_mb':0,'executable':'/usr/bin/true'})
                self.assertEqual(launch.call_args.kwargs['stdout'].name,str(state/'model-startup.log'))
                self.assertIs(launch.call_args.kwargs['stdout'],launch.call_args.kwargs['stderr'])
                self.assertIn('--log-disable',launch.call_args.args[0])
                s.unload()

    def test_external_requests_do_not_extend_managed_model_residency(self):
        with tempfile.TemporaryDirectory() as d:
            s=Supervisor(None,pathlib.Path(d));s.last_used=10
            registry={'models':{'baseline':{'status':'approved','managed':False,'endpoint':'http://local/v1','max_tokens':320,'sha256':'a'*64}}}
            response=MagicMock();response.__enter__.return_value.read.return_value=b'{"usage":{"completion_tokens":1}}'
            with patch('model_supervisor.read_registry',return_value=registry),patch.object(s,'prepare'),patch('model_supervisor.model_slot',return_value=contextlib.nullcontext()),patch('model_supervisor.urllib.request.urlopen',return_value=response):
                s.run({'model':'baseline'},'production','briefing')
                self.assertEqual(s.last_used,10)
            with patch('model_supervisor.read_registry',return_value=registry),patch.object(s,'prepare',side_effect=RuntimeError('transport')),patch('model_supervisor.model_slot',return_value=contextlib.nullcontext()):
                with self.assertRaises(RuntimeError):s.run({'model':'baseline'},'production','briefing')
                self.assertEqual(s.last_used,10)

    def test_failure_cohorts_and_capacity_deferrals(self):
        with tempfile.TemporaryDirectory() as d:
            s=Supervisor(None,pathlib.Path(d))
            registry={'models':{'baseline':{'status':'approved','managed':False}}}
            for mode,error in [('production',RuntimeError('private diagnostic')),('benchmark',RuntimeError('private diagnostic')),('production',ModelBusy())]:
                with patch('model_supervisor.read_registry',return_value=registry),patch.object(s,'prepare',side_effect=error),patch('model_supervisor.model_slot',return_value=contextlib.nullcontext()):
                    with self.assertRaises(type(error)):s.run({'model':'baseline'},mode,'briefing')
            raw=(pathlib.Path(d)/'model-events.jsonl').read_text()
            self.assertNotIn('private diagnostic',raw)
            rows=[json.loads(line) for line in raw.splitlines()]
            self.assertEqual([r['mode'] for r in rows],['production','benchmark','production'])
            self.assertEqual(rows[-1]['outcome'],'deferred')
            self.assertIsNone(rows[-1]['ok'])
            summary=summarize_events(rows)
            self.assertEqual(summary['failed'],1)
            self.assertEqual(summary['benchmark_samples'],1)
            self.assertEqual(summary['unknown_samples'],0)

    def test_candidate_rejected_before_model_load(self):
        with tempfile.TemporaryDirectory() as d:
            s=Supervisor(pathlib.Path(__file__).parent/'models.example.json',pathlib.Path(d))
            with self.assertRaises(ValueError):s.run({'model':'qwen3-06b'},'production','briefing')
            self.assertIsNone(s.process)
            s.unload() # no access to the external system service

if __name__=='__main__':unittest.main()
