"""Bounded outage recovery; one durable public-briefing write per worker."""
import json, os, socket, urllib.error, urllib.request

def transient(error):
    if isinstance(error, urllib.error.HTTPError):
        return error.code in (408, 429, 500, 502, 503, 504)
    return isinstance(error, (urllib.error.URLError, TimeoutError, ConnectionError))

class Backoff:
    def __init__(self): self.failures = 0
    def reset(self): self.failures = 0
    def delay(self):
        self.failures = min(self.failures + 1, 5)
        return min(300, 30 * 2 ** (self.failures - 1))

class PendingWrite:
    def __init__(self, path, send): self.path, self.send = path, send
    def exists(self): return self.path.exists()
    def save(self, route, data):
        if self.exists(): raise RuntimeError('Pending write must be recovered first')
        tmp = self.path.with_suffix('.tmp')
        with tmp.open('w') as f:
            os.chmod(tmp, 0o600)
            json.dump({'route': route, 'data': data}, f)
            f.flush(); os.fsync(f.fileno())
        os.replace(tmp, self.path)
        fd = os.open(self.path.parent, os.O_RDONLY)
        try: os.fsync(fd)
        finally: os.close(fd)
        return self.flush()
    def flush(self):
        if not self.exists(): return None
        record = json.loads(self.path.read_text())
        if record['route'] not in ('result', 'retry', 'pinned'):
            raise ValueError('Unexpected pending operation')
        try: result = self.send(record['route'], record['data'])
        except urllib.error.HTTPError as e:
            # An acknowledged prior write, expired lease or removed public item
            # must never overwrite a newer claimant. The queue owns recovery.
            if e.code in (400, 422):
                self.path.unlink()
                raise
            if e.code not in (404, 409): raise
            result = None
        self.path.unlink()
        return result

def model_ready(config):
    endpoint = (config.get('model_gateway') or config['model_url']).removesuffix('/v1') + '/health'
    with urllib.request.urlopen(endpoint, timeout=5) as response:
        return response.status == 200

def watchdog():
    address = os.environ.get('NOTIFY_SOCKET')
    if not address: return
    if address.startswith('@'): address = '\0' + address[1:]
    with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as sock:
        sock.sendto(b'WATCHDOG=1', address)
