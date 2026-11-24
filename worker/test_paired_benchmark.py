import unittest
from paired_benchmark import paired_report
class PairedTests(unittest.TestCase):
 def test_missing_reviews_revisions_and_timing(self):
  b={'id':'case','evidence_hash':'v1','output_hash':'baseline','valid':True,'seconds':4}
  c={**b,'output_hash':'candidate','seconds':2}
  reviews=[{'evidence_hash':'v1','output_hash':key,'verdict':value} for key,value in [('baseline','fail'),('candidate','pass')]]
  self.assertTrue(paired_report([b],[c],reviews)['quality_and_speed_improved_on_sample'])
  for changed,ratings in [(c,[]),({**c,'evidence_hash':'v2'},reviews),({**c,'seconds':None},reviews)]:
   self.assertIsNone(paired_report([b],[changed],ratings)['quality_and_speed_improved_on_sample'])
  self.assertFalse(paired_report([b],[c],reviews)['production_approved'])
