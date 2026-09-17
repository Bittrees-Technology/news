import Link from "next/link";
import { Broadsheet } from "@/components/broadsheet";
import example from "@/public/examples/bittrees-daily-2026-09-17.json";
import type { Item } from "@/lib/model";
export const metadata = {
  title: "The Bittrees Daily — 17 September 2026 example",
};
export default function Page() {
  return (
    <>
      <div className="preview-toolbar">
        <h1>A daily newspaper, made through MCP</h1>
        <p>
          This September 17 demonstration was generated from real source
          material using newspaper settings, interests, sources, feeds and
          ranking preferences. Story dates remain visible. No delivery was
          activated.
        </p>
        <p>
          <Link className="primary" href="/account">
            Create your newspaper
          </Link>{" "}
          <Link href="/account/preview">Open your editable preview</Link>
        </p>
        <details>
          <summary>View the verified workflow</summary>
          <ol>
            {example.proof.steps.map((step) => (
              <li key={step}>{step.replaceAll("_", " ")}</li>
            ))}
          </ol>
          <p>
            Subscription scheduling was tested separately for daily, weekly and
            monthly delivery. This example uses a temporary account whose
            connection was revoked after validation.
          </p>
        </details>
      </div>
      <Broadsheet
        name={example.name}
        description={example.description}
        date={example.date}
        items={example.items as Item[]}
        preview
      />
    </>
  );
}
