"""Content-free failure categories for public briefing work."""
import json
import urllib.error

def failure_category(error, phase):
    if isinstance(error, urllib.error.HTTPError):
        if error.code == 409 and phase in ('persist','pinned'):
            return 'stale_lease'
        return 'http_error'
    if isinstance(error, (urllib.error.URLError, TimeoutError, ConnectionError)):
        return 'transport'
    if isinstance(error, json.JSONDecodeError):
        return 'malformed_json'
    if isinstance(error, ValueError):
        return 'truncated_output' if str(error) == 'Truncated model output' else 'unclassified_validation'
    if type(error).__name__ == 'ModelBusy':
        return 'capacity_deferred'
    return 'unclassified'
