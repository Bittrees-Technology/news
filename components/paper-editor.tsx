"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { call } from "@/lib/browser-api";
import { Broadsheet } from "./broadsheet";
import type { Item } from "@/lib/model";
type Draft = {
  name: string;
  slug: string;
  description: string;
  draft_revision: number;
  draft: { builtAt: string; front: Item[] } | null;
};
export function PaperEditor() {
  const [paper, setPaper] = useState<Draft | null>(null),
    [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [editing, setEditing] = useState(false);
  function accept(d: Draft) {
    setPaper(d);
    setItems(d.draft?.front || []);
    setDirty(false);
  }
  useEffect(() => {
    let active = true;
    call("newspaper/draft")
      .then((d) => {
        if (active) accept(d);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(next: Item[]) {
    setItems(next);
    setDirty(true);
  }
  function move(n: number, by: number) {
    const next = [...items];
    [next[n], next[n + by]] = [next[n + by], next[n]];
    edit(next);
  }
  return (
    <>
      <div className="preview-toolbar">
        <div>
          <h1>Your newspaper preview</h1>
          <Link href="/account">Newspaper settings</Link> ·{" "}
          <Link href="/account/topics">Topics & interests</Link> ·{" "}
          <Link href="/account/sources">Sources & feeds</Link> ·{" "}
          <Link href="/account/analytics">Rankings</Link> ·{" "}
          <Link href="/account/delivery">Delivery</Link>
        </div>
        <div className="button-row">
          <button
            disabled={busy || dirty || !paper}
            onClick={() =>
              void run(async () => {
                accept(await call("newspaper/generate", {}));
                setMessage(
                  "Preview generated from your saved topics, sources and rankings.",
                );
              })
            }
          >
            {paper?.draft ? "Regenerate preview" : "Generate preview"}
          </button>
          <button disabled={!items.length} onClick={() => setEditing(!editing)}>
            {editing ? "Close editor" : "Edit contents"}
          </button>
          <button
            disabled={!items.length || dirty}
            onClick={() => window.print()}
          >
            Print / save PDF
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {dirty && (
        <p role="status">
          You have unsaved edits. Save them before publishing or regenerating.
        </p>
      )}
      {!paper && (
        <p>
          <Link href="/account">
            Sign in and save your newspaper to continue.
          </Link>
        </p>
      )}
      {paper && !paper.draft && (
        <p>
          Generate a private preview using your saved settings. This does not
          publish or send it.
        </p>
      )}
      {editing && (
        <section className="panel paper-editor">
          <h2>Edit the front page</h2>
          <p>
            Change headlines and summaries, reorder stories, or remove them.
            Source links stay attached. Regenerating replaces saved edits.
          </p>
          {items.map((i, n) => (
            <fieldset key={i.id}>
              <legend>Story {n + 1}</legend>
              <label className="field">
                Headline
                <input
                  maxLength={250}
                  value={i.title}
                  onChange={(e) =>
                    edit(
                      items.map((x) =>
                        x.id === i.id
                          ? { ...x, title: e.target.value, user_edited: true }
                          : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                Summary
                <textarea
                  maxLength={2000}
                  value={i.summary ?? i.excerpt}
                  onChange={(e) =>
                    edit(
                      items.map((x) =>
                        x.id === i.id
                          ? { ...x, summary: e.target.value, user_edited: true }
                          : x,
                      ),
                    )
                  }
                />
              </label>
              <div className="button-row">
                <button disabled={n === 0} onClick={() => move(n, -1)}>
                  Move up
                </button>
                <button
                  disabled={n === items.length - 1}
                  onClick={() => move(n, 1)}
                >
                  Move down
                </button>
                <button
                  disabled={items.length === 1}
                  onClick={() => edit(items.filter((x) => x.id !== i.id))}
                >
                  Remove story
                </button>
              </div>
            </fieldset>
          ))}
          <button
            className="primary"
            disabled={busy || !dirty || items.some((i) => !i.title.trim())}
            onClick={() =>
              void run(async () => {
                accept(
                  await call("newspaper/draft", {
                    revision: paper!.draft_revision,
                    items: items.map((i) => ({
                      id: i.id,
                      title: i.title,
                      summary: i.summary ?? i.excerpt,
                    })),
                  }),
                );
                setMessage("Edits saved privately.");
              })
            }
          >
            Save edits
          </button>
        </section>
      )}
      {paper?.draft && (
        <>
          <Broadsheet
            name={paper.name}
            description={paper.description}
            date={paper.draft.builtAt}
            items={items}
            preview
          />
          <div className="panel preview-publish">
            <h2>Ready to publish?</h2>
            <p>
              Publishing makes this reviewed edition visible to anyone with its
              address. Delivery subscriptions are managed separately.
            </p>
            <button
              className="primary"
              disabled={busy || dirty}
              onClick={() =>
                void run(async () => {
                  const r = await call("newspaper/publish-draft", {
                    revision: paper.draft_revision,
                  });
                  setMessage("Reviewed edition published. View it at " + r.url);
                })
              }
            >
              Publish this edition
            </button>{" "}
            <Link href={"/" + paper.slug}>Open newspaper</Link>
          </div>
        </>
      )}
    </>
  );
}
