import datetime,json,pathlib,tempfile,unittest
from coverage_proposal import request,grounded_draft
from editorial_metrics import record
class CoverageProposal(unittest.TestCase):
 def test_only_cited_reviewable_prose(self):
  reports=[{'id':c*64,'revision':'d'*64,'title':'River closed','excerpt':'The bridge was closed at dawn.'} for c in 'ab']
  packet={'format':'tbn-public-coverage-v1','reports':reports}
  payload=request(packet,'fixture')
  self.assertNotIn('tools',payload)
  draft={'claims':[{'text':'A closure was reported.','evidence':[{'id':0,'quote':'closed at dawn'}]}]}
  self.assertEqual(grounded_draft(packet,draft)['claims'][0]['evidence'][0]['id'],reports[0]['id'])
  for ref in [{'id':2,'quote':'closed at dawn'},{'id':0,'quote':'closed at noon'}]:
   with self.assertRaises(ValueError):grounded_draft(packet,{'claims':[{'text':'Claim','evidence':[ref]}]})
  with self.assertRaises(ValueError):request({**packet,'reports':[{**reports[0],'owner_id':'private'},reports[1]]},'fixture')
 def test_bounded_private_counts(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=pathlib.Path(tmp)
   for n in range(16):
    record(p,'fixture',{'generation':9000},['score_absent'],'saved',datetime.datetime(2026,11,1+n))
   metrics=json.loads((p/'editorial-performance.json').read_text())
   self.assertEqual(len(metrics),14)
   self.assertNotIn('2026-11-01',metrics)
   self.assertEqual(next(iter(metrics['2026-11-16'].values()))['generation_seconds_histogram'],{'15':1})
