import { viewer } from "@/lib/viewer";
import { scoreVisibility } from "@/lib/roles";
import { withTranslations } from "@/lib/translation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { latestEdition } from "@/lib/publish";
import { Newspaper } from "@/components/newspaper";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const account = await viewer();
  const { id } = await searchParams;
  if (id) {
    const e = await latestEdition(id);
    if (e) e.data.items = await withTranslations(e.data.items);
    return e ? (
      <Newspaper
        edition={JSON.parse(JSON.stringify(scoreVisibility(e, account?.role)))}
      />
    ) : (
      <p>That edition is not available.</p>
    );
  }
  const rows = (
    await pool().query(
      "SELECT id,publish_at FROM editions WHERE published_at IS NOT NULL ORDER BY publish_at DESC LIMIT 150",
    )
  ).rows;
  return (
    <>
      <div className="edition-head">
        <div>
          <h1>The archive</h1>
          <p>Every published edition, in its original form.</p>
        </div>
      </div>
      <div className="archive-list">
        {rows.map((r) => (
          <Link key={r.id} href={"/archive?id=" + encodeURIComponent(r.id)}>
            {new Date(r.publish_at).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC <span>Read edition</span>
          </Link>
        ))}
        {!rows.length && <p>The first edition is being prepared.</p>}
      </div>
    </>
  );
}
