import {addedTopics,normalizeTopic} from "./tags";
import raw from "./catalog.json";
export type Source = {
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
export const sources: Source[] = raw.map(s=>({...s,topic:normalizeTopic(s.topic)}));
export const topics = [...new Set([...sources.map((s) => s.topic),...addedTopics])].sort();
export const sourceName = (id: string) =>
  sources.find((s) => s.id === id)?.name || "Personal source";

const licenses = new Map(sources.filter(s => s.license).map(s => [s.id, s.license!]));
export const sourceLicense = (id?: string) => id ? licenses.get(id) : undefined;
