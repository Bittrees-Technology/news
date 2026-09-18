import {pageMetadata} from "@/lib/seo";
export const metadata=pageMetadata('Privacy','How The Bittrees News handles account details, wallet connections, subscriptions and optional analytics.','/privacy');
export default function Page() {
  return (
    <article className="prose">
      <h1>Privacy</h1>
      <h2>Article feedback</h2>
      <p>Guest votes and reading filters stay in this browser. When signed in, filters and read/save actions are stored with your account. Signed-in interactions carry more weight in personalized ranking; guest activity does not contribute to shared source scores.</p>
      <p>Thumbs-up and thumbs-down feedback is collected only while signed in. We store your account ID, article ID, vote and timestamps to improve article selection and source ratings. Votes are linked to your account, not anonymous. Click your selected thumb again to delete a vote; deleting your account removes its votes. Ranking uses votes from the last 90 days.</p>
      <p>
        Effective 16 September 2026. Bittrees operates this newspaper. Public
        reading requires no account. We do not add advertising trackers or sell
        reader data. Optional Bittrees Insights analytics starts only after
        consent, respects Do Not Track and Global Privacy Control, and collects
        page views and anonymous interaction/activity estimates. It does not
        collect form contents, email addresses, wallet addresses or verification
        codes. Analytics records are retained for 90 days; you can change your
        choice through the analytics controls.
      </p>
      <h2>Account data</h2>
      <p>
        We store your verified email addresses or wallet addresses, personal
        preferences, reading and saved-item state, configured feeds, delivery
        destinations and delivery records. Email-to-wallet links remain private.
        A wallet signature verifies control; we never request your private key
        or seed phrase.
      </p>
      <h2>Delivery and service providers</h2>
      <p>
        The site runs on Vercel and stores private account records in a separate
        PostgreSQL database hosted by Neon. Email is delivered through Resend.
        Wallet delivery, when enabled, uses XMTP and can be read in compatible
        clients such as Chirpy. These providers process information needed to
        operate the service. Source publishers receive normal requests when you
        open their links.
      </p>
      <p>
        Public news excerpts may be processed by a configured Bittrees-hosted
        summarization service. Private account details are not included in the
        public editorial prompt. No paid AI provider is enabled by default.
      </p>
      <h2>Named newspapers</h2>
      <p>
        Named newspapers and their feed pages are private until you publish
        them. Publishing makes your newspaper name, introduction, feed names and
        selected public-source stories visible at their custom addresses. Your
        account details and personal RSS connections remain private. You can
        unpublish your newspaper in Your newspaper settings.
      </p>
      <h2>AI connections and ranking history</h2>
      <p>
        You can grant a revocable AI connection permission to read or curate
        your own newspaper. Public publishing requires a separate permission.
        Ranking history stores scores, sample counts and the scoring settings in
        effect; it does not store your interest notes. AI activity logs record
        tool names and outcomes, not prompts or connection keys. Custom sources
        remain private unless you explicitly allow their stories in published
        editions. Enabling automatic publication authorizes scheduled public
        snapshots.
      </p>
      <h2>Controls and retention</h2>
      <p>
        Delivery is opt-in per verified destination. You may pause it, remove a
        destination, or delete your account in settings. Deletion removes live
        account records, preferences, personal feeds and delivery records. It
        cannot recall messages already delivered to another mailbox or XMTP
        inbox. Provider logs and infrastructure backups follow those providers’
        retention policies.
      </p>
      <p>
        Sign-in sessions expire after 22 hours. Verification challenges expire
        after ten minutes. This site uses essential session cookies and browser
        storage for reading preferences; it does not use marketing cookies.
      </p>
      <h2>Questions</h2>
      <p>
        Use the{" "}
        <a href="https://github.com/Bittrees-Technology/news/issues">
          project support tracker
        </a>{" "}
        for general questions. Never include verification codes or other private
        information in public issues.
      </p>
    </article>
  );
}
