import {pageMetadata} from "@/lib/seo";
export const metadata=pageMetadata('About & sources','How The Bittrees News selects sources and publishes world, economy, technology and science news three times daily.','/about');
import { sources } from "@/lib/catalog";
export default function Page() {
  return (
    <article className="prose">
      <h1>About the newspaper</h1>
      <p>
        The Bittrees News (TBN) brings world reporting, economic developments,
        technology and scientific research into a short, source-linked
        newspaper. The latest snapshot is free to read without an account.
      </p>
      <h2>Three editions, every day</h2>
      <p>
        Publication is scheduled for 07:57, 11:57 and 19:57 UTC. The main
        edition is at 11:57. If preparation fails, the last successful edition
        remains available with its original timestamp.
      </p>
      <h2>Sources and summaries</h2>
      <p>
        Our catalogue contains {sources.length} public news, research, podcast
        and data endpoints. Availability varies and is checked during
        collection. The Bittrees-hosted model selects short source passages,
        checked against the original text before publication. These are labelled
        AI-selected source excerpts. Publisher excerpts and historical data
        observations are identified separately. Follow the original link for
        context and corrections.
      </p>
      <p>
        Research may include preprints. Summaries can contain errors and are not
        investment, medical or legal advice. The original publisher is the
        authoritative source for its reporting.
      </p>
      <h2>Your edition</h2>
      <p>
        An account lets you select sources, topics and interests, maintain a
        saved library, add private-to-your-account public feeds, and choose
        verified delivery destinations. Those settings do not change the public
        newspaper.
      </p>
      <h2>Corrections and support</h2>
      <p>
        Report a broken source or correction through the{" "}
        <a href="https://github.com/Bittrees-Technology/news/issues">
          project issue tracker
        </a>
        . Do not post private email addresses, credentials or wallet
        verification codes in public issues.
      </p>
    </article>
  );
}
