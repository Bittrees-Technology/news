import {articleTags,tagStyle} from "@/lib/tags";
import {ArticleFeedback} from "./article-feedback";
import type { Item } from "@/lib/model";
import { newspaperPages } from "@/lib/pagination";
import { sourceName } from "@/lib/catalog";
export function Broadsheet({
  name,
  description,
  date,
  items,
  preview = false,
}: {
  name: string;
  description?: string;
  date: string;
  items: Item[];
  preview?: boolean;
}) {
  const pages = newspaperPages(items);
  const editionDate = new Date(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="newspaper-pages">
      <nav className="paper-page-nav" aria-label="Newspaper pages">
        <span>
          {pages.length} {pages.length === 1 ? "page" : "pages"}
        </span>
        {pages.map((_, index) => (
          <a key={index} href={"#newspaper-page-" + (index + 1)}>
            Page {index + 1}
          </a>
        ))}
      </nav>
      {pages.map((page, pageIndex) => (
        <section
          key={pageIndex}
          id={"newspaper-page-" + (pageIndex + 1)}
          className={
            "broadsheet paper-sheet" +
            (pageIndex === 0 ? " paper-front" : " paper-inside")
          }
          aria-label={`${preview ? "Newspaper preview" : name}, page ${pageIndex + 1} of ${pages.length}`}
        >
          {pageIndex === 0 ? (
            <header className="paper-masthead">
              <p className="paper-date">
                {editionDate}
                {preview ? " · Preview" : ""}
              </p>
              <h1>{name}</h1>
              {description && <p className="paper-deck">{description}</p>}
              <div className="paper-edition">
                <span>Published with The Bittrees News</span>
                <span>{items.length} stories</span>
              </div>
            </header>
          ) : (
            <header className="paper-running-head">
              <strong>{name}</strong>
              <span>{editionDate}</span>
              <span>Page {pageIndex + 1}</span>
            </header>
          )}
          {pageIndex > 0 && (
            <h2 className="paper-inside-title">More from this edition</h2>
          )}
          {!items.length && <p>No stories in this edition.</p>}
          <div className="paper-columns">
            {page.map((i, n) => (
              <article
                className={
                  n === 0 && pageIndex === 0
                    ? "paper-story paper-lead"
                    : "paper-story"
                }
                key={i.id}
              >
                <p className="paper-section">{articleTags(i).map(tag=><span className="colored-tag" style={tagStyle(tag)} key={tag}>{tag}</span>)}</p>
                <h2>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    {i.translation?.title || i.title}
                  </a>
                </h2>
                <p className="paper-byline">
                  {sourceName(i.source_id)} ·{" "}
                  {new Date(i.published_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </p>
                <p className="paper-copy">
                  {i.translation?.summary ?? i.summary ?? i.excerpt}
                </p>
                {!preview && <ArticleFeedback id={i.id} />}
                {!preview&&!i.owner_id&&<a href={`/story/${i.id}`}>Full briefing ↗</a>}
                {i.user_edited && (
                  <p className="paper-edit-note">
                    Edited by the newspaper owner.{" "}
                    <a href={i.url} target="_blank" rel="noopener noreferrer">
                      Read the original
                    </a>
                    .
                  </p>
                )}
              </article>
            ))}
          </div>
          <footer className="paper-colophon">
            <span>
              Sourced excerpts and summaries. Full reporting belongs to the
              linked publishers.
            </span>
            <strong>
              Page {pageIndex + 1} of {pages.length}
            </strong>
          </footer>
        </section>
      ))}
    </div>
  );
}
