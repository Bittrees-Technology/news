// Numeric claims must occur in the source text. This is a screening check,
 // not a semantic accuracy judgment.
export function translationNumbersSupported(original:{title:string;summary:string}, translated:{title?:string;summary?:string}) {
  const numbers=(text:string)=>[...text.matchAll(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*/gu)].map(m=>m[0]);
  const permitted=new Set(numbers(original.title+' '+original.summary));
  return numbers((translated.title||'')+' '+(translated.summary||'')).every(n=>permitted.has(n));
}
