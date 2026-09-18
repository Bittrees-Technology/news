import {withBriefings} from '@/lib/story-documents';
import { EditionSchema } from "@/components/edition-schema";
import { pageMetadata, siteName, siteDescription, siteUrl } from "@/lib/seo";
const baseMetadata=pageMetadata(siteName,siteDescription,"/");
export const metadata = {...baseMetadata,alternates:{...baseMetadata.alternates,types:{"application/rss+xml":"/rss.xml"}}};
import { viewer } from "@/lib/viewer";
import { scoreVisibility } from "@/lib/roles";
import { withTranslations } from "@/lib/translation";
import { recentPublicRanked } from "@/lib/ranking";
import { latestEdition } from "@/lib/publish";
import { Newspaper } from "@/components/newspaper";
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await viewer();
  let edition = null;
  try {
    edition = await latestEdition();
    if (edition)
      edition.data.items = await withTranslations(
        await withBriefings(await recentPublicRanked()),
      );
  } catch {}
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": siteUrl + "/#organization",
                name: siteName,
                url: siteUrl,
                logo: siteUrl + "/brand/tbn-512.png",
              },
              {
                "@type": "WebSite",
                "@id": siteUrl + "/#website",
                name: siteName,
                alternateName: "TBN",
                url: siteUrl,
                inLanguage: "en",
                description: siteDescription,
                publisher: { "@id": siteUrl + "/#organization" },
              },
            ],
          }),
        }}
      />
      {edition && (
        <EditionSchema
          name={siteName}
          path="/"
          date={edition.published_at}
          items={edition.data.items.filter((i) => i.kind !== "podcast")}
        />
      )}
      <Newspaper
        live
        edition={
          edition
            ? JSON.parse(
                JSON.stringify(scoreVisibility(edition, account?.role)),
              )
            : null
        }
      />
    </>
  );
}
