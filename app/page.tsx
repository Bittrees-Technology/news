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
    <Newspaper
      live
      edition={
        edition
          ? JSON.parse(JSON.stringify(scoreVisibility(edition, account?.role)))
          : null
      }
    />
  );
}
