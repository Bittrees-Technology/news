"""Do not spend briefing claims while the local archive dependency is offline."""
import socket
import urllib.error


def archive_ready():
    try:
        with socket.create_connection(('127.0.0.1', 5001), timeout=2):
            return True
    except OSError:
        return False


def defer_archive_error(error, phase):
    # HTTP errors and malformed responses still follow normal bounded retries.
    # Connection loss after the preflight is a dependency deferral, not quality failure.
    return phase == 'archive' and isinstance(error, urllib.error.URLError) and not isinstance(error, urllib.error.HTTPError)
