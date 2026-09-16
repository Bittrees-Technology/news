import Link from "next/link";
import { notFound } from "next/navigation";
import { viewer } from "@/lib/viewer";
import { newspaperPage } from "@/lib/newspapers";
import { Newspaper } from "./newspaper";
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
      <Newspaper
        key={paper.slug + "/" + (feed || "")}
        initialItems={JSON.parse(JSON.stringify(paper.items))}
        title={
          paper.feedName ? `${paper.name} / ${paper.feedName}` : paper.name
        }
        description={
          paper.description || "A personal newspaper, curated with TBN."
        }
        mode="named"
      />
    </>
  );
}
