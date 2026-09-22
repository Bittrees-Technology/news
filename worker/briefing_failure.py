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
    if type(error).__name__ == 'KeyPointQualityError':
        return 'key_point_quality'
    if isinstance(error, ValueError):
        return 'truncated_output' if str(error) == 'Truncated model output' else 'unclassified_validation'
    if type(error).__name__ == 'ModelBusy':
        return 'capacity_deferred'
    return 'unclassified'

def failure_label(error, phase):
    """Persist bounded diagnostics, never exception text, URLs or model output."""
    safe_phase = phase if phase in ('claim', 'generate', 'persist', 'archive', 'pinned') else 'unknown'
    label = failure_category(error, safe_phase) + ':' + safe_phase
    if isinstance(error, urllib.error.HTTPError) and isinstance(error.code, int) and 100 <= error.code <= 599:
        label += ':http_' + str(error.code)
    return label
