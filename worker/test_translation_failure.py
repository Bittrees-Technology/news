import json, unittest, urllib.error
from translation_failure import failure_category

class TranslationFailureTests(unittest.TestCase):
    def test_validation_categories(self):
        for message, category in [('Invalid translation','invalid_size'),('Output is not confidently English','language_check'),('Source text was not translated','unchanged_text'),('Truncated model output','truncated_output')]:
            self.assertEqual(failure_category(ValueError(message),'translate'),category)
    def test_transport_and_phase(self):
        e=urllib.error.HTTPError('https://example.org/private',409,'private',{},None)
        self.assertEqual(failure_category(e,'persist'),'stale_lease')
        self.assertEqual(failure_category(e,'translate'),'http_error')
        self.assertEqual(failure_category(urllib.error.URLError('private'),'claim'),'transport')
    def test_no_exception_content(self):
        self.assertEqual(failure_category(ValueError('private source text'),'translate'),'unclassified_validation')
        self.assertEqual(failure_category(Exception('secret'),'claim'),'unclassified')
        self.assertEqual(failure_category(json.JSONDecodeError('private','secret',0),'translate'),'malformed_json')
