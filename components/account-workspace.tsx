"use client";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Account, type AccountSection } from "./account";
import { browserApi } from "@/lib/browser-api";
export function AccountWorkspace() {
  const pathname = usePathname();
  const generation = useSyncExternalStore(
    browserApi.subscribe,
    browserApi.getGeneration,
    () => 0,
  );
  const section =
    pathname === "/account" ? "newspaper" : pathname.split("/")[2];
  if (
    ![
      "newspaper",
      "topics",
      "sources",
      "delivery",
      "analytics",
      "ai",
      "settings",
      "access",
      "editorial",
    ].includes(section)
  )
    return null;
  return (
    <div data-insights-ignore="true">
      <Account key={generation} section={section as AccountSection} />
    </div>
  );
}
