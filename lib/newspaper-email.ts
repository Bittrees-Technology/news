import type { Item } from "./model";
import { sourceName } from "./catalog";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function newspaperEmail(
  name: string,
  items: Item[],
  date: string,
  unsubscribe: string,
) {
  const stories = items
    .map(
      (i) =>
        `<article style="padding:20px 0;border-bottom:1px solid #999"><p style="font-size:12px">${escape(i.topic)} · ${escape(sourceName(i.source_id))}</p><h2 style="font-family:Georgia,serif;font-size:25px;line-height:1.2;margin:8px 0"><a style="color:#181818" href="${escape(i.url)}">${escape(i.title)}</a></h2><p style="font-size:12px;color:#555">${escape(new Date(i.published_at).toISOString().slice(0, 10))}</p><p style="font-size:16px;line-height:1.65">${escape(i.summary || i.excerpt)}</p>${i.user_edited ? '<p style="font-size:12px">Edited by the newspaper owner. The headline links to the original source.</p>' : ""}</article>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#eeede6;color:#181818"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:680px;background:#fffef8;padding:24px;font-family:Georgia,serif"><tr><td><header style="text-align:center;border-bottom:5px double #181818"><p>${escape(date)}</p><h1 style="font-size:38px;line-height:1.1">${escape(name)}</h1><p style="font-size:13px">Published with The Bittrees News</p></header>${stories}<footer style="padding-top:24px;font-size:12px"><p>Full reporting belongs to the linked publishers.</p><a href="${escape(unsubscribe)}">Pause this subscription</a></footer></td></tr></table></td></tr></table></body></html>`;
}
