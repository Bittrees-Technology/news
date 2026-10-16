import unittest
from idle_polling import IdlePolling

class IdlePollingTests(unittest.TestCase):
    def test_translation_backoff_is_bounded(self):
        p = IdlePolling(15)
        self.assertEqual([p.empty_delay() for _ in range(6)], [15, 30, 60, 60, 60, 60])

    def test_each_worker_resets_on_claim(self):
        for initial in (15, 25, 45):
            p = IdlePolling(initial)
            for _ in range(10): p.empty_delay()
            p.reset()
            self.assertEqual(p.empty_delay(), initial)

    def test_workers_have_independent_state(self):
        editor, translation = IdlePolling(25), IdlePolling(15)
        editor.empty_delay()
        self.assertEqual(translation.empty_delay(), 15)
        self.assertEqual(editor.empty_delay(), 50)

    def test_invalid_bounds_rejected(self):
        for initial, maximum in ((0, 60), (-1, 60), (61, 60)):
            with self.assertRaises(ValueError): IdlePolling(initial, maximum)

if __name__ == "__main__": unittest.main()
