import unittest,json
from briefing_quality import validate_key_points,validate_briefing_content,KeyPointQualityError

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

class Sections(unittest.TestCase):
    def test_separate_sections_are_required(self):
        good={'overview':'The study reports findings from the supplied source evidence.', 'points':['The trial enrolled 120 adults in 2025.'], 'context':'The trial studied adults enrolled during 2025.', 'limitations':'Long-term outcomes were not provided.'}
        self.assertEqual(validate_briefing_content(json.dumps(good)),good)
        for bad in [dict(good,context=None),dict(good,context=good['limitations']),dict(good,limitations='short')]:
            with self.assertRaises(KeyPointQualityError):validate_briefing_content(json.dumps(bad))

if __name__=='__main__':unittest.main()
