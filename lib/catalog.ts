import {addedTopics,normalizeTopic} from "./tags";
import raw from "./catalog.json";
export type Source = {
  retired?: boolean;
  pollMinutes?: number;
  maxResponseBytes?: number;
  maxItems?: number;
  publication?: string;
  feedDescriptionOnly?: boolean;
  requiresByline?: boolean;
  license?: {name: string; url: string};
  publisherFamily?: string;
  id: string;
  name: string;
  url: string;
  homepage: string;
  topic: string;
  kind: string;
  type: string;
};
export const allSources: Source[] = raw.map(s=>({...s,topic:normalizeTopic(s.topic)}));
export const sources = allSources.filter(s => !s.retired);
export const topics = [...new Set([...sources.map((s) => s.topic),...addedTopics])].sort();
export const sourceName = (id: string) =>
  allSources.find((s) => s.id === id)?.name || "Personal source";

const licenses = new Map(allSources.filter(s => s.license).map(s => [s.id, s.license!]));
export const sourceLicense = (id?: string) => id ? licenses.get(id) : undefined;
