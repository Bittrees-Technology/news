import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as request } from "undici";
export function publicAddress(ip: string) {
  if (isIP(ip) === 6)
    return (
      /^[23][0-9a-f]{0,3}:/i.test(ip) &&
      !/^2001:(db8|0):/i.test(ip) &&
      !ip.includes(".")
    );
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && c === 0))) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224 ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export class SourceFetchError extends Error {
 constructor(public status:number,public retryAfterSeconds=0){super(`Source returned HTTP ${status}`);}
}
export type FetchValidators={etag?:string|null;lastModified?:string|null};
export async function safeFetch(url:string,maxBytes=2_000_000):Promise<string>{return (await safeFetchResponse(url,maxBytes)).body;}
export async function safeFetchResponse(
  url: string,
  maxBytes = 2_000_000,
  validators:FetchValidators={},
): Promise<{body:string;etag:string|null;lastModified:string|null;bytes:number;notModified:boolean}> {
  let current = url;
  for (let step = 0; step < 4; step++) {
    const u = new URL(current);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      (u.port && u.port !== "443")
    )
      throw Error("Only public HTTPS endpoints are supported");
    const records = await lookup(u.hostname, { all: true });
    if (!records.length || records.some((r) => !publicAddress(r.address)))
      throw Error("Private network addresses are not allowed");
    const chosen = records[0];
    const agent = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if ((options as { all?: boolean }).all)
            (callback as unknown as (e: null, r: unknown) => void)(null, [
              chosen,
            ]);
          else callback(null, chosen.address, chosen.family);
        },
      },
    });
    try {
      const r = await request(current, {
        redirect: "manual",
        dispatcher: agent,
        signal: AbortSignal.timeout(15000),
        headers: {
          ...(current===url && validators.etag ? {"If-None-Match":validators.etag} : {}),
          ...(current===url && validators.lastModified ? {"If-Modified-Since":validators.lastModified} : {}),
          "User-Agent": "BittreesNews/1.0 (+https://news.bittrees.org)",
          Accept:
            "application/rss+xml, application/atom+xml, application/json, text/xml;q=0.9, */*;q=0.5",
        },
      });
      if(r.status===304){await r.body?.cancel();if(!validators.etag&&!validators.lastModified)throw Error("Unexpected unvalidated 304 response");return {body:"",etag:r.headers.get("etag")||validators.etag||null,lastModified:r.headers.get("last-modified")||validators.lastModified||null,bytes:0,notModified:true};}
      if (r.status >= 300 && r.status < 400) {
        const next = r.headers.get("location");
        await r.body?.cancel();
        if (!next) throw Error("Redirect has no destination");
        current = new URL(next, current).toString();
        continue;
      }
      if (!r.ok) {
        await r.body?.cancel();
        const retry=r.headers.get('retry-after');
        const seconds=retry ? (/^\d+$/.test(retry)?Number(retry):Math.max(0,(Date.parse(retry)-Date.now())/1000)) : 0;
        throw new SourceFetchError(r.status,Number.isFinite(seconds)?seconds:0);
      }
      if (Number(r.headers.get("content-length")) > maxBytes) {
        await r.body?.cancel();
        throw Error("Source response is too large");
      }
      let size = 0;
      const chunks: Uint8Array[] = [];
      for await (const chunk of r.body!) {
        size += chunk.length;
        if (size > maxBytes) throw Error("Source response is too large");
        chunks.push(chunk);
      }
      return {body:Buffer.concat(chunks).toString("utf8"),etag:r.headers.get("etag"),lastModified:r.headers.get("last-modified"),bytes:size,notModified:false};
    } finally {
      await agent.close();
    }
  }
  throw Error("Too many redirects");
}
