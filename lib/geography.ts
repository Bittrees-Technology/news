import data from "./geography-data.json";
import type { Item } from "./model";
export const countries = data.countries;
export const regions = [
  ...new Set(countries.map((c) => c.region)),
  "Middle East",
].sort();
const aliases: Record<string, string[]> = {
  PT: ["Portuguese", "Lisbon", "Lisboa", "Porto"],
  US: [
    "United States of America",
    "American",
    "Washington DC",
    "Washington, D.C.",
  ],
  GB: [
    "United Kingdom",
    "Britain",
    "British",
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
  ],
  CN: ["Chinese", "Beijing"],
  JP: ["Japanese", "Tokyo"],
  IN: ["Indian", "New Delhi"],
  DE: ["German", "Berlin"],
  FR: ["French", "Paris"],
  ES: ["Spanish", "Madrid"],
  IT: ["Italian"],
  BR: ["Brazilian"],
  CA: ["Canadian"],
  AU: ["Australian"],
  UA: ["Ukrainian", "Kyiv"],
  RU: ["Russian", "Moscow"],
  IL: ["Israeli"],
  PS: ["Palestine", "Palestinian", "Gaza", "West Bank"],
  IR: ["Iranian"],
  KR: ["South Korean"],
  KP: ["North Korean"],
  TW: ["Taiwanese"],
  TR: ["Türkiye", "Turkish"],
  AE: ["Emirati"],
  SA: ["Saudi"],
  CZ: ["Czech Republic"],
  CI: ["Ivory Coast"],
  NZ: ["New Zealander"],
};
const abbreviations: Record<string, string[]> = {
  US: ["US", "USA", "U.S.", "U.S.A."],
  GB: ["UK", "U.K."],
  AE: ["UAE"],
};
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (terms: string[], flags = "iu") =>
  new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:${terms.map(escape).join("|")})(?=$|[^\\p{L}\\p{N}])`,
    flags,
  );
const matchers = countries.map((c) => ({
  ...c,
  match: pattern([c.name, ...(aliases[c.code] || [])].map(normalize)),
  short: abbreviations[c.code] ? pattern(abbreviations[c.code], "u") : null,
}));
const middleEast = new Set([
  "AE",
  "BH",
  "CY",
  "EG",
  "IL",
  "IQ",
  "IR",
  "JO",
  "KW",
  "LB",
  "OM",
  "PS",
  "QA",
  "SA",
  "SY",
  "TR",
  "YE",
]);
const regionMatchers = regions.map((name) => ({
  name,
  match: pattern(
    [
      name,
      ...(name === "Europe"
        ? ["European", "European Union"]
        : name === "Asia"
          ? ["Asian"]
          : name === "Africa"
            ? ["African"]
            : name === "Oceania"
              ? ["Pacific Islands"]
              : []),
    ].map(normalize),
  ),
}));
export function geographyFor(
  item: Pick<Item, "title" | "excerpt" | "summary" | "topic">,
) {
  // Geography describes places mentioned in the story, never the publisher's headquarters.
  const original = [
    item.title,
    item.excerpt,
    item.summary || "",
    item.topic,
  ].join(" ");
  const text = normalize(original);
  const found = matchers.filter(
    (c) => c.match.test(text) || c.short?.test(original),
  );
  const regional = new Set(found.map((c) => c.region));
  for (const { name, match } of regionMatchers)
    if (match.test(text)) regional.add(name);
  if (found.some((c) => middleEast.has(c.code))) regional.add("Middle East");
  return { countries: found.map((c) => c.code), regions: [...regional] };
}
export function matchesGeography(
  geo: ReturnType<typeof geographyFor>,
  country: string,
  region: string,
) {
  return (
    (!country || geo.countries.includes(country)) &&
    (!region || geo.regions.includes(region))
  );
}
