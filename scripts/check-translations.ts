import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { pool } from "../lib/db";
import {
  withTranslations,
  translationKey,
  saveTranslation,
} from "../lib/translation";
import type { Item } from "../lib/model";
const item: Item = {
  id: createHash("sha256").update(randomUUID()).digest("hex"),
  source_id: "translation-test",
  url: "https://example.org/translation-test",
  title: "Investigação em Lisboa",
  excerpt: "Investigadores anunciaram resultados.",
  topic: "Science",
  kind: "article",
  summary_kind: "excerpt",
  published_at: "2000-01-01T00:00:00Z",
};
const key = translationKey(item),
  lease = randomUUID();
try {
  await pool().query(
    "INSERT INTO items(id,source_id,title,excerpt,topic,kind,published_at,url) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      item.id,
      item.source_id,
      item.title,
      item.excerpt,
      item.topic,
      item.kind,
      item.published_at,
      item.url,
    ],
  );
  const [queued] = await withTranslations([item]);
  assert.equal(queued.translation_status, "pending");
  assert.equal(queued.title, item.title);
  const [privateItem] = await withTranslations([
    { ...item, owner_id: randomUUID() },
  ]);
  assert.equal(privateItem.translation_key, undefined);
  const [custom] = await withTranslations([
    { ...item, summary: "My private account-specific annotation." },
  ]);
  assert.equal(custom.translation_key, undefined);
  await pool().query(
    "UPDATE translations SET status='working',lease=$2,attempts=1,claimed_at=now() WHERE key=$1",
    [key, lease],
  );
  await assert.rejects(
    saveTranslation({
      key,
      lease: randomUUID(),
      language: "en",
      model: "test",
    }),
    /lease/,
  );
  await saveTranslation({
    key,
    lease,
    language: "pt",
    title: "Research in Lisbon",
    summary: "Researchers announced results.",
    model: "test",
  });
  const [translated] = await withTranslations([item]);
  assert.equal(translated.translation?.title, "Research in Lisbon");
  assert.equal(translated.title, item.title);
  assert.equal(translated.excerpt, item.excerpt);
  assert.equal(
    (await pool().query("SELECT title FROM items WHERE id=$1", [item.id]))
      .rows[0].title,
    item.title,
  );
  console.log(
    "Passed translation caching, original preservation, private-source/annotation exclusion, and stale-lease rejection.",
  );
} finally {
  await pool().query("DELETE FROM translations WHERE key=$1", [key]);
  await pool().query("DELETE FROM items WHERE id=$1", [item.id]);
  await pool().end();
}
