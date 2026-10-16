"""Bound idle queue polling; reset immediately after a successful claim."""
class IdlePolling:
    def __init__(self, initial_seconds, maximum_seconds=60):
        if not 0 < initial_seconds <= maximum_seconds:
            raise ValueError("Invalid idle polling bounds")
        self.initial = initial_seconds
        self.maximum = maximum_seconds
        self.delay = initial_seconds

    def empty_delay(self):
        delay = self.delay
        self.delay = min(self.maximum, delay * 2)
        return delay

    def reset(self):
        self.delay = self.initial
