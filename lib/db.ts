import { Pool, type PoolClient } from "pg";
const globalDb = globalThis as unknown as { newsPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw Error("News storage is not configured");
  return (globalDb.newsPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  }));
}
export async function tx<T>(fn: (db: PoolClient) => Promise<T>) {
  const d = await pool().connect();
  try {
    await d.query("BEGIN");
    const v = await fn(d);
    await d.query("COMMIT");
    return v;
  } catch (e) {
    await d.query("ROLLBACK");
    throw e;
  } finally {
    d.release();
  }
}
export const schema = `
CREATE TABLE IF NOT EXISTS editor_jobs(id text PRIMARY KEY,publish_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending',payload jsonb NOT NULL,claimed_at timestamptz,result jsonb,error text);
CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),preferences jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS identities(kind text NOT NULL CHECK(kind IN ('email','wallet')),value text NOT NULL,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,verified_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,value));
CREATE TABLE IF NOT EXISTS sessions(hash text PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS challenges(id uuid PRIMARY KEY,kind text NOT NULL,value text NOT NULL,secret_hash text NOT NULL,browser_hash text NOT NULL,account_id uuid REFERENCES accounts ON DELETE CASCADE,purpose text NOT NULL,payload text,expires_at timestamptz NOT NULL,attempts int NOT NULL DEFAULT 0,consumed boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS rate_limits(key text PRIMARY KEY,hits int NOT NULL,resets_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS sources(id text PRIMARY KEY,status text NOT NULL DEFAULT 'unchecked',checked_at timestamptz,error text,item_count int NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS items(id text PRIMARY KEY,source_id text NOT NULL,topic text NOT NULL,kind text NOT NULL,title text NOT NULL,url text NOT NULL,excerpt text NOT NULL,summary text,summary_kind text NOT NULL DEFAULT 'excerpt',published_at timestamptz NOT NULL,fetched_at timestamptz NOT NULL DEFAULT now(),owner_id uuid REFERENCES accounts ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS items_period ON items(published_at DESC);
CREATE INDEX IF NOT EXISTS items_owner ON items(owner_id);
CREATE TABLE IF NOT EXISTS editions(id text PRIMARY KEY,publish_at timestamptz NOT NULL,prepared_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,brief text NOT NULL,data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS reading(account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,item_id text NOT NULL REFERENCES items ON DELETE CASCADE,is_read boolean NOT NULL DEFAULT false,saved boolean NOT NULL DEFAULT false,PRIMARY KEY(account_id,item_id));
CREATE TABLE IF NOT EXISTS connections(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,name text NOT NULL,url text NOT NULL,topic text NOT NULL,status text NOT NULL DEFAULT 'pending',error text,checked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS destinations(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('email','wallet')),value text NOT NULL,verified_at timestamptz NOT NULL DEFAULT now(),reachable boolean NOT NULL DEFAULT false,enabled boolean NOT NULL DEFAULT false,cadence text NOT NULL DEFAULT 'daily' CHECK(cadence IN ('daily','weekly','monthly')),revision int NOT NULL DEFAULT 1,unsubscribe_hash text NOT NULL,UNIQUE(account_id,kind,value));
CREATE TABLE IF NOT EXISTS deliveries(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,destination_id uuid NOT NULL REFERENCES destinations ON DELETE CASCADE,revision int NOT NULL,period text NOT NULL,status text NOT NULL DEFAULT 'pending',payload jsonb NOT NULL,provider_id text,error text,created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,UNIQUE(destination_id,period));
CREATE TABLE IF NOT EXISTS jobs(id text PRIMARY KEY,status text NOT NULL,started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,detail jsonb);
CREATE TABLE IF NOT EXISTS worker_state(id text PRIMARY KEY,updated_at timestamptz NOT NULL DEFAULT now(),data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS suppressions(value text PRIMARY KEY,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS newspapers(account_id uuid PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,name text NOT NULL,slug text NOT NULL UNIQUE,description text NOT NULL DEFAULT '',published boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS newspaper_feeds(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES newspapers(account_id) ON DELETE CASCADE,name text NOT NULL,slug text NOT NULL,preferences jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(account_id,slug));
REVOKE ALL ON SCHEMA public FROM PUBLIC;
`;
