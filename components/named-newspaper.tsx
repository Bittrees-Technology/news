import { scoreVisibility } from "@/lib/roles";
import { withTranslations } from "@/lib/translation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { viewer } from "@/lib/viewer";
import { newspaperPage } from "@/lib/newspapers";
import { Broadsheet } from "./broadsheet";
export async function NamedNewspaper({
  slug,
  feed,
}: {
  slug: string;
  feed?: string;
}) {
  const account = await viewer();
  const paper = await newspaperPage(slug, feed, account?.id);
  if (!paper) notFound();
  return (
    <>
      <nav className="account-tabs" aria-label="Newspaper sections">
        <Link href={"/" + paper.slug} aria-current={!feed ? "page" : undefined}>
          Front cover
        </Link>
        {paper.feeds.map((f) => (
          <Link
            key={f.slug}
            href={`/${paper.slug}/${f.slug}`}
            aria-current={f.slug === feed ? "page" : undefined}
          >
            {f.name}
          </Link>
        ))}
      </nav>
      {!paper.published && (
        <p className="notice">
          Private newspaper. Only you can see these pages.{" "}
          <Link href="/account">Manage visibility</Link>
        </p>
      )}
      {paper.publishedAt && (
        <p className="muted">
          Edition published{" "}
          {new Date(paper.publishedAt).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC
        </p>
      )}
      {paper.published && (
        <p>
          <Link
            className="primary"
            href={`/account/delivery?paper=${encodeURIComponent(paper.slug)}${feed ? "&feed=" + encodeURIComponent(feed) : ""}`}
          >
            Subscribe to {paper.feedName || paper.name}
          </Link>
        </p>
      )}
      <Broadsheet
        name={paper.feedName ? `${paper.name} / ${paper.feedName}` : paper.name}
        description={paper.description}
        date={paper.publishedAt || new Date().toISOString()}
        items={JSON.parse(
          JSON.stringify(
            scoreVisibility(await withTranslations(paper.items), account?.role),
          ),
        )}
      />
    </>
  );
}
