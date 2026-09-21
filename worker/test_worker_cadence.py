import unittest
from worker_cadence import briefing_delay

class CadenceTests(unittest.TestCase):
    def test_only_success_reduces_idle_time(self):
        self.assertEqual(briefing_delay(True),5)
        for value in [0,5,15,100,None,float('nan')]:
            self.assertEqual(briefing_delay(False,value),15)
    def test_success_delay_is_bounded_and_rollback_configurable(self):
        self.assertEqual(briefing_delay(True,15),15)
        self.assertEqual(briefing_delay(True,0),5)
        self.assertEqual(briefing_delay(True,100),15)
        for value in [None,True,'0',float('inf'),float('nan')]:
            self.assertEqual(briefing_delay(True,value),5)
