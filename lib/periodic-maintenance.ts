import type { Pool } from "pg";

// The transaction-scoped lock also works through a transaction pooler.
// Completion is recorded only after successful work; crashes allow a retry.
export async function periodicMaintenance<T>(db: Pool, task: () => Promise<T>): Promise<T | null> {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL statement_timeout = '10s'");
    const locked = (await c.query("SELECT pg_try_advisory_xact_lock(hashtextextended('news:processing-sample:v1',0)) AS acquired")).rows[0].acquired;
    if (!locked) { await c.query("ROLLBACK"); return null; }
    const recent = await c.query("SELECT 1 FROM worker_state WHERE id='processing-maintenance-v1' AND updated_at>clock_timestamp()-interval '5 minutes'");
    if (recent.rowCount) { await c.query("COMMIT"); return null; }
    const result = await task();
    await c.query("INSERT INTO worker_state(id,updated_at,data) VALUES('processing-maintenance-v1',clock_timestamp(),'{}') ON CONFLICT(id) DO UPDATE SET updated_at=EXCLUDED.updated_at");
    await c.query("COMMIT");
    return result;
  } catch (error) {
    await c.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { c.release(); }
}
