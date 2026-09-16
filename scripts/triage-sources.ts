import { sources } from "../lib/catalog";
import { fetchSource, storeItems } from "../lib/collect";
import { pool } from "../lib/db";
const failed = (
  await pool().query("SELECT id FROM sources WHERE status='unavailable'")
).rows;
let index = 0;
try {
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (index < failed.length) {
        const id = failed[index++].id;
        const source = sources.find((s) => s.id === id);
        if (!source) continue;
        const started = Date.now();
        try {
          const items = await fetchSource(source);
          await storeItems(items);
          await pool().query(
            "UPDATE sources SET status='healthy',checked_at=now(),error=NULL,item_count=$2 WHERE id=$1",
            [source.id, items.length],
          );
          console.log(
            JSON.stringify({
              source: source.name,
              status: "healthy",
              items: items.length,
              ms: Date.now() - started,
            }),
          );
        } catch (e) {
          const error = (e as Error).message;
          await pool().query(
            "UPDATE sources SET checked_at=now(),error=$2 WHERE id=$1",
            [source.id, error.slice(0, 200)],
          );
          console.log(
            JSON.stringify({
              source: source.name,
              status: "unavailable",
              error,
              ms: Date.now() - started,
            }),
          );
        }
      }
    }),
  );
} finally {
  await pool().end();
}
