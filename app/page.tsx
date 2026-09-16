import { sourceHealth } from "@/lib/source-health";
import { publicRanked } from "@/lib/ranking";
import { latestEdition } from "@/lib/publish";
import { Newspaper } from "@/components/newspaper";
export const dynamic = "force-dynamic";
export default async function Page() {
  let edition = null;
  const health = await sourceHealth().catch(() => null);
  try {
    edition = await latestEdition();
    if (edition) edition.data.items = await publicRanked(edition.data.items);
  } catch {}
  return (
    <Newspaper
      health={health}
      edition={edition ? JSON.parse(JSON.stringify(edition)) : null}
    />
  );
}
