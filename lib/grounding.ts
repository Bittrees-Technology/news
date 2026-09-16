// The hosted small model selects a passage; it cannot publish an invented paraphrase.
export function isSourcePassage(summary: string, evidence: string) {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  return (
    clean(summary).length >= 10 && clean(evidence).includes(clean(summary))
  );
}
