import { NamedNewspaper } from "@/components/named-newspaper";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ newspaper: string }>;
}) {
  const p = await params;
  return <NamedNewspaper slug={p.newspaper} />;
}
