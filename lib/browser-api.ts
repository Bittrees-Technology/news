// Per-browser-memory presentation cache. Server authorization is never cached here.
const lifetimes: Record<string, number> = {
  session: 30_000,
  feedback: 30_000,
  account: 60_000,
  sources: 300_000,
  newspaper: 30_000,
  ranking: 60_000,
  "mcp/tokens": 15_000,
};
type Entry = { value: any; until: number };
export class SupersededRequest extends Error {
  constructor() {
    super("The account changed. Please retry.");
  }
}
export class BrowserApi {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<any>>();
  private revisions = new Map<string, number>();
  private generation = 0;
  private identity: string | null | undefined;
  private listeners = new Set<() => void>();
  constructor(
    private fetcher: typeof fetch,
    private changed: () => void = () => {},
    private clock = Date.now,
  ) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getGeneration = () => this.generation;
  private notify() {
    this.listeners.forEach((fn) => fn());
  }
  peek(path: string) {
    const e = this.entries.get(path);
    return e && e.until > this.clock() ? e.value : undefined;
  }
  invalidate(paths: string[]) {
    for (const path of paths) {
      this.entries.delete(path);
      this.pending.delete(path);
      this.revisions.set(path, (this.revisions.get(path) || 0) + 1);
    }
  }
  reset = () => {
    this.generation++;
    this.identity = undefined;
    this.invalidate(Object.keys(lifetimes));
    this.notify();
  };
  private observe(value: any) {
    const identity = value.account
      ? `${value.account.id}:${value.account.role || "member"}`
      : null;
    if (this.identity !== undefined && this.identity !== identity) this.reset();
    this.identity = identity;
    this.entries.set("session", {
      value: { account: value.account, emailReady: value.emailReady },
      until: this.clock() + lifetimes.session,
    });
  }
  request(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ): Promise<any> {
    const cached = method === "GET" && lifetimes[path];
    if (cached) {
      const value = this.peek(path);
      if (value !== undefined) return Promise.resolve(value);
      const active = this.pending.get(path);
      if (active) return active;
    }
    const generation = this.generation,
      revision = this.revisions.get(path) || 0;
    const request = (async () => {
      const r = await this.fetcher("/api/" + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const d = await r.json();
      // A response begun under another identity or superseded by a write cannot repopulate the cache or UI.
      if (
        generation !== this.generation ||
        (cached && revision !== (this.revisions.get(path) || 0))
      )
        throw new SupersededRequest();
      if (!r.ok) {
        if (r.status === 401) {
          this.reset();
          this.changed();
        }
        throw Error(d.error || "Request failed");
      }
      if (method === "GET") {
        if (path === "account" || path === "session") this.observe(d);
        if (cached)
          this.entries.set(path, {
            value: d,
            until: this.clock() + lifetimes[path],
          });
      } else if (
        path === "auth/verify" ||
        path === "auth/logout" ||
        (path === "account" && method === "DELETE")
      ) {
        this.reset();
        this.changed();
      } else if (path !== "auth/start") {
        const invalidations = path === "feedback" ? ["feedback","ranking","sources"] : path.startsWith("mcp/tokens")
          ? ["mcp/tokens"]
          : path.startsWith("ranking")
            ? ["ranking"]
            : path.startsWith("newspaper")
              ? ["newspaper", "ranking"]
              : path.startsWith("connections")
                ? ["account", "newspaper", "ranking", "sources"]
                : path === "subscriptions"
                  ? ["account"]
                  : path === "preferences"
                    ? ["account", "newspaper", "ranking"]
                    : path.startsWith("destinations")
                      ? ["account"]
                      : [];
        this.invalidate(invalidations);
      }
      return d;
    })();
    if (cached) {
      this.pending.set(path, request);
      void request
        .finally(() => {
          if (this.pending.get(path) === request) this.pending.delete(path);
        })
        .catch(() => {});
    }
    return request;
  }
}
let channel: BroadcastChannel | undefined;
export const browserApi = new BrowserApi(
  (...args) => fetch(...args),
  () => {
    if (typeof window === "undefined") return;
    channel?.postMessage("identity-changed");
    window.dispatchEvent(new Event("news-auth"));
  },
);
export function connectAuthEvents() {
  if (
    typeof window === "undefined" ||
    channel ||
    !("BroadcastChannel" in window)
  )
    return;
  channel = new BroadcastChannel("tbn-auth-state");
  channel.onmessage = (event) => {
    if (event.data !== "identity-changed") return;
    browserApi.reset();
    window.dispatchEvent(new Event("news-auth"));
  };
}
export const cachedData = (path: string) =>
  typeof window === "undefined" ? undefined : browserApi.peek(path);
export const call = (path: string, body?: unknown, method?: string) =>
  browserApi.request(path, body, method);
export function prefetchAccountSection(section: string) {
  const path = (
    {
      newspaper: "newspaper",
      sources: "sources",
      analytics: "analytics",
      ai: "mcp/tokens",
    } as Record<string, string>
  )[section];
  if (path) void call(path).catch(() => {});
}
