import type { Item } from "./model";
/** Keep whole stories together; long owner edits receive a sheet of their own. */
export function newspaperPages(items: Item[]): Item[][] {
  const pages: Item[][] = [];
  let page: Item[] = [],
    weight = 0;
  for (const item of items) {
    const size =
      (item.translation?.title || item.title).length * 3 +
      (item.translation?.summary ?? item.summary ?? item.excerpt ?? "").length +
      350;
    const limit = pages.length === 0 ? 3 : 4;
    if (page.length && (page.length >= limit || weight + size > 3400)) {
      pages.push(page);
      page = [];
      weight = 0;
    }
    page.push(item);
    weight += size;
  }
  if (page.length || !pages.length) pages.push(page);
  return pages;
}
