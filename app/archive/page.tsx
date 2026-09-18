import {notFound} from "next/navigation";
import {pageMetadata,privateMetadata} from "@/lib/seo";
import { viewer } from "@/lib/viewer";
import { scoreVisibility } from "@/lib/roles";
import { withTranslations } from "@/lib/translation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { latestEdition } from "@/lib/publish";
import { Newspaper } from "@/components/newspaper";
export const dynamic = "force-dynamic";
export async function generateMetadata({searchParams}:{searchParams:Promise<{id?:string}>}) {
 const {id}=await searchParams;
 if(!id)return pageMetadata("Edition archive","Browse past editions of The Bittrees News, with source-linked world, economy, technology and science reporting.","/archive");
 const e=await latestEdition(id);if(!e)return privateMetadata;
 return pageMetadata("Edition "+new Date(e.publish_at).toISOString().slice(0,16).replace("T"," ")+" UTC","Read this archived edition of The Bittrees News and follow each story to its original source.","/archive?id="+encodeURIComponent(id));
}
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
      notFound()
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
