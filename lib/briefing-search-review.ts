// Search holds apply to a specific archived version. A later CID receives its own eligibility decision.
export const prostStoryId = "50c4f9c3d106741c8bd7c9255a60deaa2c6bd3c3ef9daaf9a886cb3ad045ec03";
export const prostBriefingCid = "bafybeic5d2c4f4pqudwl47bl75qfhdl3n3v5pmxkt3hldpgpmjp6l5xou4";

const searchHolds: Readonly<Record<string, string>> = {
  [prostBriefingCid]: "Correction: Kimberly Prost is an ICC judge who tries war-crimes cases. An automated translation wrongly described her as being tried. The generated briefing also contained unsupported claims and has been withdrawn from this page.",
  "bafybeibio75biotzukdcheujkxcpnruocotnmn5uh2pe7xrrrwse42yz44": "Al Jazeera reports that Rohingya residents dismantled their homes amid an eviction threat. The separate claims about troop deployments in this briefing need supporting evidence.",
  "bafybeiacx3rpxg424njwig5dtm25jyiof7ldn5kjiqcgg7hn7dtkurg3kq": "STAT reports that Petunia was treated as a calf and was five years old when profiled. At publication, none of the clinic's patients had received the treatment.",
  "bafybeidduj5pjjxvaqozcapawuzmg6ljnu2oqqln2kyuucg5htd3h4lgbu": "The original report describes a possible release equivalent to 80 billion metric tons of carbon dioxide by 2100. The archived briefing uses a different unit.",
  "bafybeiaafm7ntobftzdccs4pqqzwda4j3hphuraofpsl3sbtsr3c7rr7n4": "The BBC reported that Eva Marie Saint died at 102. The archived overview contradicts the headline on that point.",
  "bafybeiejukurmkssc4gqh6a6vqg45hcngxtzv47uyc56jzdndv3qnrnkm4": "The benchmark reports the share of tasks completed safely on all five attempts. Its strongest configuration had at least one violation on 27.3% of tasks across those attempts.",
  "bafybeieqbpm7h4onbdi2cxtlgfnz7ty5cqq7426amcikpmiqo32e5c5ana": "The linked source is a Reddit post. The claims about Samsung devices and an OpenAI account action remain unverified."
};

export const heldBriefingCids = Object.keys(searchHolds);

export function briefingSearchNote(cid?: string | null): string | undefined {
  return cid && Object.hasOwn(searchHolds, cid) ? searchHolds[cid] : undefined;
}

export function correctProstDisplay<T extends {id:string; owner_id?:string|null; title:string; excerpt:string; summary?:string|null; translation?:unknown}>(item:T):T {
  if (item.id !== prostStoryId || item.owner_id) return item;
  return {...item, title:"ICC judge Kimberly Prost tries war-crimes cases and is a target of US sanctions",
    excerpt:"Al Jazeera reports on sanctions affecting ICC judge Kimberly Prost.",
    summary:"Al Jazeera reports on sanctions affecting ICC judge Kimberly Prost.", translation:undefined};
}
