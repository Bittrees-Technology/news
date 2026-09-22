import unittest
from briefing_quality import validate_key_points,KeyPointQualityError

class KeyPoints(unittest.TestCase):
    def test_sparse_evidence_accepts_one_fact(self):
        data={'points':['The experiment measured a 12% increase in efficiency.']}
        self.assertEqual(validate_key_points(data),data)
    def test_duplicate_and_generic_points_rejected(self):
        for points in [
            ['The experiment measured a 12% increase in efficiency.']*2,
            ['The report discusses important research findings.'],
            [],['short'],[None],
        ]:
            with self.assertRaises(KeyPointQualityError):validate_key_points({'points':points})
    def test_distinct_facts_pass(self):
        validate_key_points({'points':['The trial enrolled 120 adults in 2025.','The authors report a 12% improvement, with uncertain long-term effects.']})

if __name__=='__main__':unittest.main()
