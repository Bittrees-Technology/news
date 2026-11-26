import data from "./geography-data.json";
import type { Item } from "./model";
export const countries = data.countries;
export const regions = [
  ...new Set(countries.map((c) => c.region)),
  "Middle East",
].sort();
const aliases: Record<string, string[]> = {
  PT: ["Portuguese", "português", "portuguesa", "portugueses", "portuguesas", "Lisbon", "Lisboa", "Porto"],
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
  BR: ["Brazilian", "Brasil", "Brasília", "São Paulo", "Porto Alegre", "Porto Velho"],
  ZA: ["South African", "África do Sul", "Johannesburg", "Pretoria", "Cape Town"],
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
// These Brazilian city names also contain the full name of a Portuguese city.
const brazilianPorto = /\bporto (?:alegre|velho)\b/gu;
const portugalMatcher = matchers.find(country => country.code === "PT")!.match;
function mentionsPortugal(normalized: string) {
  return portugalMatcher.test(normalized.replace(brazilianPorto, " "));
}
export function portugalInSource(title: string, excerpt: string) {
  return mentionsPortugal(normalize([title, excerpt].join(" ")));
}
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
  ].join(" ");
  const text = normalize(original);
  const found = matchers.filter(
    (c) => c.code === "PT" ? mentionsPortugal(text) : c.match.test(text) || c.short?.test(original),
  );
  const regional = new Set(found.map((c) => c.region));
  for (const { name, match } of regionMatchers)
    if (match.test(text)) regional.add(name);
  if (found.some((c) => middleEast.has(c.code))) regional.add("Middle East");
  return { countries: found.map((c) => c.code), regions: [...regional] };
}
// Conservative event-place hints for editorial review. Demonyms and a publisher's
// origin are insufficient, and multiple explicit locations require a reviewer.
const cityCountry:Record<string,string>={Lisbon:'PT',Lisboa:'PT',Porto:'PT','Porto Alegre':'BR','Porto Velho':'BR','Moçambique':'MZ',Maputo:'MZ',Brasil:'BR',Tokyo:'JP'};
const locationCodes=new Map([...countries.map(c=>[c.name.toLowerCase(),c.code] as const),
  ...Object.entries(cityCountry).map(([name,code])=>[name.toLowerCase(),code] as const)]);
const locationCue=new RegExp('(?:^|\\s)(?:in|across|near|em|no|na|nos|nas)\\s+('+
  [...locationCodes.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?=$|[^\\p{L}])','giu');
export function locationEvidence(item: Pick<Item,'title'|'excerpt'>) {
  return [...item.title.matchAll(locationCue)].map(match=>{
    const end=match.index!+match[0].length;
    return {country:locationCodes.get(match[1].toLowerCase())!,field:'title',start:end-match[1].length,end};
  });
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
