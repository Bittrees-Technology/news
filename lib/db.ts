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
CREATE TABLE IF NOT EXISTS translations(key text PRIMARY KEY,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending',attempts int NOT NULL DEFAULT 0,lease uuid,claimed_at timestamptz,result jsonb,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
CREATE INDEX IF NOT EXISTS translations_pending ON translations(status,created_at);
CREATE TABLE IF NOT EXISTS editor_jobs(id text PRIMARY KEY,publish_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending',payload jsonb NOT NULL,claimed_at timestamptz,result jsonb,error text);
CREATE TABLE IF NOT EXISTS accounts(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),preferences jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS identities(kind text NOT NULL CHECK(kind IN ('email','wallet')),value text NOT NULL,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,verified_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,value));
CREATE TABLE IF NOT EXISTS news_role_grants(kind text NOT NULL CHECK(kind IN ('email','wallet')),value text NOT NULL,role text NOT NULL CHECK(role IN ('member','moderator','editor','admin','super_admin')),protected boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,value));
CREATE TABLE IF NOT EXISTS news_staff_audit(id uuid PRIMARY KEY,actor uuid NOT NULL,action text NOT NULL,detail jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news_reviews(item_id text PRIMARY KEY,status text NOT NULL CHECK(status IN ('flagged','reviewed','approved')),note text NOT NULL,actor uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
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
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS curation_lease_until timestamptz;
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS publication_version int NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ranking jsonb NOT NULL DEFAULT '{}';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS next_curation_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS auto_publish boolean NOT NULL DEFAULT false;
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS auto_cadence text NOT NULL DEFAULT 'daily';
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS next_publish_at timestamptz;
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS last_published_at timestamptz;
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS publish_error text;
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS snapshot jsonb;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS share_public boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS article_curation(account_id uuid REFERENCES accounts ON DELETE CASCADE,item_id text REFERENCES items ON DELETE CASCADE,summary text,excluded boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,item_id));
CREATE TABLE IF NOT EXISTS source_observations(source_id text,observed_at timestamptz,status text NOT NULL,PRIMARY KEY(source_id,observed_at));
CREATE TABLE IF NOT EXISTS ranking_history(owner_key text NOT NULL,kind text NOT NULL,entity_id text NOT NULL,name text NOT NULL,bucket timestamptz NOT NULL,score numeric NOT NULL,position int NOT NULL,samples int NOT NULL,config jsonb NOT NULL,PRIMARY KEY(owner_key,kind,entity_id,bucket));
CREATE INDEX IF NOT EXISTS ranking_history_recent ON ranking_history(owner_key,bucket DESC);
CREATE TABLE IF NOT EXISTS mcp_tokens(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,name text NOT NULL,hash text UNIQUE NOT NULL,scopes text[] NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,last_used_at timestamptz);
CREATE TABLE IF NOT EXISTS curation_audit(id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,actor text NOT NULL,action text NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,destination_id uuid NOT NULL REFERENCES destinations ON DELETE CASCADE,target text NOT NULL CHECK(target IN ('main','personal','newspaper','feed')),target_key text NOT NULL,newspaper_owner uuid REFERENCES accounts ON DELETE CASCADE,feed_id uuid REFERENCES newspaper_feeds ON DELETE CASCADE,cadence text NOT NULL CHECK(cadence IN ('daily','weekly','monthly')),enabled boolean NOT NULL DEFAULT false,revision int NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(account_id,destination_id,target_key));
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES news_subscriptions ON DELETE CASCADE;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS subscription_revision int;
CREATE TABLE IF NOT EXISTS newspaper_editions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES accounts ON DELETE CASCADE,published_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS newspaper_editions_period ON newspaper_editions(account_id,published_at DESC);
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS draft jsonb;
ALTER TABLE newspapers ADD COLUMN IF NOT EXISTS draft_revision int NOT NULL DEFAULT 0;
ALTER TABLE mcp_tokens ADD COLUMN IF NOT EXISTS validated_at timestamptz;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
`;
