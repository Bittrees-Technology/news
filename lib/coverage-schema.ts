export const coverageSchema = `
CREATE TABLE IF NOT EXISTS news_article_annotations(item_id text PRIMARY KEY,version integer NOT NULL,revision text NOT NULL,facets jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS news_article_annotations_facets ON news_article_annotations USING gin(facets jsonb_path_ops);
CREATE TABLE IF NOT EXISTS news_coverage_events(id uuid PRIMARY KEY,version integer NOT NULL,edit jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news_coverage_members(item_id text PRIMARY KEY,event uuid NOT NULL REFERENCES news_coverage_events);
CREATE INDEX IF NOT EXISTS news_coverage_members_event ON news_coverage_members(event);
CREATE TABLE IF NOT EXISTS news_coverage_history(event uuid REFERENCES news_coverage_events,version integer,actor uuid NOT NULL,edit jsonb NOT NULL,PRIMARY KEY(event,version));
`;
