import raw from "./catalog.json";
export type Source = {
  id: string;
  name: string;
  url: string;
  homepage: string;
  topic: string;
  kind: string;
  type: string;
};
export const sources: Source[] = raw;
export const topics = [...new Set(sources.map((s) => s.topic))].sort();
export const sourceName = (id: string) =>
  sources.find((s) => s.id === id)?.name || "Personal source";
