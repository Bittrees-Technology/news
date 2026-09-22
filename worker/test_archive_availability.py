import unittest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError
from archive_availability import archive_ready, defer_archive_error

class ArchiveAvailabilityTests(unittest.TestCase):
    def test_local_preflight_closes_connection(self):
        connection = MagicMock()
        with patch('archive_availability.socket.create_connection', return_value=connection) as connect:
            self.assertTrue(archive_ready())
        connect.assert_called_once_with(('127.0.0.1', 5001), timeout=2)
        connection.__exit__.assert_called_once()

    def test_offline_dependency_does_not_require_a_claim(self):
        with patch('archive_availability.socket.create_connection', side_effect=ConnectionRefusedError):
            self.assertFalse(archive_ready())

    def test_only_archive_transport_loss_is_deferred(self):
        error = URLError(ConnectionRefusedError())
        self.assertTrue(defer_archive_error(error, 'archive'))
        self.assertFalse(defer_archive_error(error, 'generate'))
        self.assertFalse(defer_archive_error(error, 'persist'))
        self.assertFalse(defer_archive_error(HTTPError('local', 500, '', {}, None), 'archive'))
        self.assertFalse(defer_archive_error(ValueError('bad archive response'), 'archive'))

if __name__ == '__main__': unittest.main()
