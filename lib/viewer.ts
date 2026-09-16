import { cookies } from "next/headers";
import { currentAccount } from "./auth";
export async function viewer() {
  const c = await cookies();
  return currentAccount(
    new Request("https://news.bittrees.org", {
      headers: { cookie: c.toString() },
    }),
    false,
  );
}
