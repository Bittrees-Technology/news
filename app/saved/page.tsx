import {privateMetadata} from "@/lib/seo";
export const metadata=privateMetadata;
import { Newspaper } from "@/components/newspaper";
export default function Page() {
  return <Newspaper mode="saved" />;
}
