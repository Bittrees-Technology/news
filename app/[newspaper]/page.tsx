import {newspaperMetadata} from "@/lib/newspaper-seo";
import { NamedNewspaper } from "@/components/named-newspaper";
export const dynamic = "force-dynamic";
export async function generateMetadata({params}:{params:Promise<{newspaper:string;feed?:string}>}) {const p=await params;return newspaperMetadata(p.newspaper,p.feed);}
export default async function Page({
  params,
}: {
  params: Promise<{ newspaper: string }>;
}) {
  const p = await params;
  return <NamedNewspaper slug={p.newspaper} />;
}
