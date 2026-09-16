import test from "node:test";
import assert from "node:assert/strict";
import { countries, geographyFor, matchesGeography } from "../lib/geography";
import { publicAddress } from "../lib/safe-fetch";
const story = (title: string, topic = "World") => ({
  title,
  topic,
  excerpt: "",
  summary: "",
});
test("country and region filters match story places and Portugal remains selectable", () => {
  const geo = geographyFor(
    story(
      "Portuguese researchers develop new solar cells in Lisbon",
      "Science",
    ),
  );
  assert(matchesGeography(geo, "PT", ""));
  assert(matchesGeography(geo, "", "Europe"));
  assert(!matchesGeography(geo, "JP", ""));
  assert(!matchesGeography(geo, "", "Asia"));
  assert(countries.some((c) => c.code === "PT" && c.name === "Portugal"));
  assert.equal(new Set(countries.map((c) => c.code)).size, countries.length);
});
test("location matches use word boundaries and do not mistake ordinary us for the US", () => {
  assert(
    !geographyFor(
      story("What this tells us about uncertainty"),
    ).countries.includes("US"),
  );
  assert(
    geographyFor(story("U.S. economic growth accelerates")).countries.includes(
      "US",
    ),
  );
  assert(!geographyFor(story("Brain scan advances")).countries.includes("IN"));
});
test("regional stories need not name a country; All restores unclassified stories", () => {
  const europe = geographyFor(
    story("European Union announces research programme"),
  );
  assert(matchesGeography(europe, "", "Europe"));
  assert(!matchesGeography(europe, "PT", ""));
  const global = geographyFor(
    story("A new telescope measures distant stars", "Science"),
  );
  assert(matchesGeography(global, "", ""));
  assert(!matchesGeography(global, "", "Asia"));
  assert(
    geographyFor(story("Gaza aid talks resume")).regions.includes(
      "Middle East",
    ),
  );
});
test("public WordPress publisher addresses are allowed, while neighboring special networks remain blocked", () => {
  for (const ip of ["192.0.66.108", "192.0.78.232", "192.0.78.128"])
    assert(publicAddress(ip), ip);
  for (const ip of ["192.0.0.1", "192.0.0.8", "192.168.1.1"])
    assert(!publicAddress(ip), ip);
});
