import { latestEdition } from "@/lib/publish";
import { Newspaper } from "@/components/newspaper";
export const dynamic = "force-dynamic";
export default async function Page() {
  let edition = null;
  try {
    edition = await latestEdition();
  } catch {}
  return (
    <Newspaper edition={edition ? JSON.parse(JSON.stringify(edition)) : null} />
  );
}
