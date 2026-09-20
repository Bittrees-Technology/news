import unittest
from telemetry_summary import summarize_events

class TelemetryTests(unittest.TestCase):
    def test_cohort_isolation(self):
        result=summarize_events([
            {'mode':'production','ok':True,'inference_seconds':2,'at':100},
            {'mode':'production','ok':False,'at':110},
            {'mode':'benchmark','ok':True,'inference_seconds':100,'at':120},
            {'ok':False,'at':130},
        ])
        self.assertEqual((result['completed'],result['failed'],result['median_seconds']),(1,1,2))
        self.assertEqual((result['event_samples'],result['benchmark_samples'],result['unknown_samples']),(4,1,1))
        self.assertEqual(result['sample_start'],'1970-01-01T00:01:40Z')
        self.assertEqual(result['sample_end'],'1970-01-01T00:02:10Z')
    def test_window_and_empty(self):
        result=summarize_events([{'mode':'production','ok':False}]+[{'mode':'benchmark'}]*1000)
        self.assertEqual(result['failed'],0)
        self.assertEqual(result['event_samples'],1000)
        self.assertIsNone(result['sample_start'])
        self.assertIsNone(summarize_events([])['median_seconds'])
    def test_invalid_timing_not_zero(self):
        result=summarize_events([{'mode':'production','ok':True,'inference_seconds':float('nan')}])
        self.assertEqual(result['completed'],1)
        self.assertIsNone(result['median_seconds'])
