import copy,json,pathlib,tempfile,unittest
from model_registry import read_registry,artifact_key
from model_supervisor import Supervisor

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
    def test_candidate_rejected_before_model_load(self):
        with tempfile.TemporaryDirectory() as d:
            s=Supervisor(pathlib.Path(__file__).parent/'models.example.json',pathlib.Path(d))
            with self.assertRaises(ValueError):s.run({'model':'qwen3-06b'},'production','briefing')
            self.assertIsNone(s.process)
            s.unload() # no access to the external system service

if __name__=='__main__':unittest.main()
