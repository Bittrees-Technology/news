import {pageMetadata,siteName,siteDescription,siteUrl} from "@/lib/seo";
export const metadata=pageMetadata(siteName,siteDescription,"/");
import { viewer } from "@/lib/viewer";
import { scoreVisibility } from "@/lib/roles";
import { withTranslations } from "@/lib/translation";
import { publicRanked } from "@/lib/ranking";
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
        await publicRanked(edition.data.items),
      );
  } catch {}
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":siteUrl+"/#organization",name:siteName,url:siteUrl,logo:siteUrl+"/brand/tbn-512.png"},{"@type":"WebSite","@id":siteUrl+"/#website",name:siteName,alternateName:"TBN",url:siteUrl,inLanguage:"en",description:siteDescription,publisher:{"@id":siteUrl+"/#organization"}}]})}} />
    <Newspaper
      live
      edition={
        edition
          ? JSON.parse(JSON.stringify(scoreVisibility(edition, account?.role)))
          : null
      }
    />
    </>
  );
}
