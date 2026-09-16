import { AccountWorkspace } from "@/components/account-workspace";
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AccountWorkspace />
      {children}
    </>
  );
}
