// One bounded entry per process; never serves stale values after the TTL.
export function boundedPublicCache<T>(ttlMs: number, now = Date.now) {
  let cached: {key: string; value: T; expires: number} | undefined;
  let pending: {key: string; promise: Promise<T>} | undefined;
  let generation = 0;
  return (key: string, load: () => Promise<T>): Promise<T> => {
    if (cached?.key === key && now() < cached.expires) return Promise.resolve(cached.value);
    if (pending?.key === key) return pending.promise;
    const version = ++generation;
    const promise = Promise.resolve().then(load).then(value => {
      if (version === generation) cached = {key, value, expires: now() + ttlMs};
      return value;
    }).finally(() => { if (version === generation) pending = undefined; });
    pending = {key, promise};
    return promise;
  };
}
