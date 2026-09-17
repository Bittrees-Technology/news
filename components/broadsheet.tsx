import type { Item } from "@/lib/model";
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
  return (
    <section
      className="broadsheet"
      aria-label={preview ? "Newspaper preview" : name}
    >
      <header className="paper-masthead">
        <p className="paper-date">
          {new Date(date).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
          {preview ? " · Preview" : ""}
        </p>
        <h1>{name}</h1>
        {description && <p className="paper-deck">{description}</p>}
        <div className="paper-edition">
          <span>Published with The Bittrees News</span>
          <span>{items.length} stories</span>
        </div>
      </header>
      {!items.length && <p>No stories in this edition.</p>}
      <div className="paper-columns">
        {items.map((i, n) => (
          <article
            className={n === 0 ? "paper-story paper-lead" : "paper-story"}
            key={i.id}
          >
            <p className="paper-section">{i.topic}</p>
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
        A curated edition of sourced excerpts and summaries. Full reporting
        belongs to the linked publishers.
      </footer>
    </section>
  );
}
