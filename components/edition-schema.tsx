import { siteUrl } from "@/lib/seo";
import type { Item } from "@/lib/model";
/** Describe this curated collection without claiming authorship of source reporting. */
export function EditionSchema({
  name,
  path,
  date,
  items,
}: {
  name: string;
  path: string;
  date?: string;
  items: Item[];
}) {
  const url = new URL(path, siteUrl).href;
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url + "#edition",
    url,
    name,
    inLanguage: "en",
    ...(date ? { dateModified: date } : {}),
    isPartOf: { "@id": siteUrl + "/#website" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, n) => ({
        "@type": "ListItem",
        position: n + 1,
        url: item.url,
        name: item.translation?.title || item.title,
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
