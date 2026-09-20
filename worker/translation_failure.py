"""Bounded diagnostic labels; never return exception text or source content."""
import json
import urllib.error

def failure_category(error, phase):
    if isinstance(error, urllib.error.HTTPError):
        if phase=='persist' and error.code==409:
            return 'stale_lease'
        return 'http_error'
    if isinstance(error, (urllib.error.URLError, TimeoutError, ConnectionError)):
        return 'transport'
    if isinstance(error, json.JSONDecodeError):
        return 'malformed_json'
    if isinstance(error, ValueError):
        return {
            'Invalid translation':'invalid_size',
            'Output is not confidently English':'language_check',
            'Source text was not translated':'unchanged_text',
            'Truncated model output':'truncated_output',
        }.get(str(error),'unclassified_validation')
    if type(error).__name__=='LangDetectException':
        return 'language_detection'
    return 'unclassified'
