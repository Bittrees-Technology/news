import {AccountWorkspace} from "@/components/account-workspace";
import {privateMetadata} from "@/lib/seo";
export const metadata = {...privateMetadata, title: "Get the daily email | The Bittrees News"};
export default function Page() { return <AccountWorkspace dailyEmail/>; }
