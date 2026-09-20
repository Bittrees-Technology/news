import {addedTopics,normalizeTopic} from "./tags";
import raw from "./catalog.json";
export type Source = {
  pollMinutes?: number;
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
