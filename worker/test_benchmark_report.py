import unittest
from benchmark_report import summarize

class BenchmarkReportTests(unittest.TestCase):
    def test_valid_json_cannot_hide_quality_failure_or_missing_timings(self):
        rows=[{'model':'small','id':'injection','valid':True,'seconds':2},{'model':'small','id':'other','valid':False,'error':'HTTP 502'}]
        report=summarize(rows,[{'model':'small','id':'injection','verdict':'fail'}])[0]
        self.assertEqual(report['quality_gate'],'failed')
        self.assertEqual(report['quality_failed'],1)
        self.assertEqual(report['structural_valid_percent'],50)
        self.assertEqual(report['timed_cases'],1)
        self.assertEqual(report['untimed_cases'],1)
        self.assertEqual(report['factual_review_pending'],1)
        self.assertFalse(report['production_approved'])
    def test_even_reviewed_passes_cannot_approve_production(self):
        report=summarize([{'model':'small','id':'one','valid':True,'seconds':2}],[{'model':'small','id':'one','verdict':'pass'}])[0]
        self.assertEqual(report['quality_gate'],'not approved')
        self.assertFalse(report['production_approved'])
        self.assertEqual(report['factual_review_pending'],0)
