import json,unittest,urllib.error
from briefing_failure import failure_category
from model_runtime import ModelBusy

class BriefingFailureTests(unittest.TestCase):
    def test_output_failures_are_distinct_without_returning_content(self):
        self.assertEqual(failure_category(ValueError('Truncated model output'),'generate'),'truncated_output')
        self.assertEqual(failure_category(json.JSONDecodeError('private text','secret source',0),'generate'),'malformed_json')
        self.assertEqual(failure_category(ValueError('secret source'),'generate'),'unclassified_validation')
        self.assertEqual(failure_category(RuntimeError('private token'),'claim'),'unclassified')
    def test_stale_lease_is_not_confused_with_archive_http_failure(self):
        error=urllib.error.HTTPError('https://private',409,'secret',{},None)
        for phase in ['persist','pinned']:
            self.assertEqual(failure_category(error,phase),'stale_lease')
        for phase in ['archive','claim','generate']:
            self.assertEqual(failure_category(error,phase),'http_error')
    def test_transport_and_resource_deferrals(self):
        self.assertEqual(failure_category(TimeoutError(),'generate'),'transport')
        self.assertEqual(failure_category(ModelBusy(),'generate'),'capacity_deferred')
