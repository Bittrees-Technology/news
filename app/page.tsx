import { EditionSchema } from "@/components/edition-schema";
import { pageMetadata, siteName, siteDescription, siteUrl } from "@/lib/seo";
const baseMetadata=pageMetadata(siteName,siteDescription,"/");
export const metadata = {...baseMetadata,alternates:{...baseMetadata.alternates,types:{"application/rss+xml":"/rss.xml"}}};
import { viewer } from "@/lib/viewer";
import { scoreVisibility } from "@/lib/roles";
import { publicHome } from "@/lib/public-home";
import { Newspaper } from "@/components/newspaper";
export const dynamic = "force-dynamic";
export default async function Page() {
  const [account,edition]=await Promise.all([viewer(),publicHome().catch(()=>null)]);
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
