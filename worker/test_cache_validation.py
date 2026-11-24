import json,pathlib,tempfile,unittest
from unittest.mock import patch,MagicMock
from model_runtime import completion
from briefing_quality import validate_briefing_content,KeyPointQualityError
class CacheValidation(unittest.TestCase):
 def test_rejected_content_is_not_cached(self):
  with tempfile.TemporaryDirectory() as folder:
   state=pathlib.Path(folder);config={'model_url':'http://fixture','model':'fixture'}
   result={'choices':[{'message':{'content':json.dumps({'points':['The report discusses new research.']})},'finish_reason':'stop'}]}
   response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps(result).encode()
   with patch('model_runtime.urllib.request.urlopen',return_value=response):
    with self.assertRaises(KeyPointQualityError):completion(config,state,{},'briefing',validator=validate_briefing_content)
   self.assertEqual(list((state/'inference-cache').glob('*.json')),[])
 def test_old_rejected_cache_evicted_then_valid_result_reused(self):
  with tempfile.TemporaryDirectory() as folder:
   state=pathlib.Path(folder);config={'model_url':'http://fixture','model':'fixture'}
   result={'choices':[{'message':{'content':json.dumps({'points':['The report discusses new research.']})},'finish_reason':'stop'}]}
   response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps(result).encode()
   with patch('model_runtime.urllib.request.urlopen',return_value=response) as request:
    completion(config,state,{},'briefing')
    with self.assertRaises(KeyPointQualityError):completion(config,state,{},'briefing',validator=validate_briefing_content)
    self.assertEqual(request.call_count,1)
    result['choices'][0]['message']['content']=json.dumps({'overview':'The source describes a trial enrolling 120 adults in 2025.', 'points':['The trial enrolled 120 adults in 2025.'], 'context':'The trial studied adults enrolled during 2025.', 'limitations':'Long-term outcomes were not provided.'})
    response.__enter__.return_value.read.return_value=json.dumps(result).encode()
    completion(config,state,{},'briefing',validator=validate_briefing_content)
    completion(config,state,{},'briefing',validator=validate_briefing_content)
    self.assertEqual(request.call_count,2)

class CachePruning(unittest.TestCase):
 def test_expired_and_oldest_removed_without_touching_other_files(self):
  import os
  from model_runtime import prune_cache
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp)
   for name,stamp in [('expired.json',1),('older.json',3000000),('newer.json',3000001),('keep.log',1)]:
    f=root/name;f.write_text('evidence');os.utime(f,(stamp,stamp))
   (root/'linked.json').symlink_to(root/'keep.log')
   prune_cache(root,3000002,limit=1)
   self.assertEqual(sorted(p.name for p in root.iterdir()),['keep.log','linked.json','newer.json'])
