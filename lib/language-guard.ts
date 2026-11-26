// A conservative screen for obvious Portuguese output. This is not a language
// detector or proof of English; uncertain cases still require editorial review.
const common=new Set(['que','para','uma','não','com','dos','das','por','mais','foi','são','também','esta','pelo','pela','entre','sobre','seus','suas','como','ainda','pode','está','após','anos','hoje','quando','portugal','notícias','será','segundo']);
const distinctive=new Set(['não','são','também','está','após','notícias','será','portugal','segundo','uma','dos','das','pelo','pela']);
export function looksPortuguese(text:string) {
 const words=text.toLocaleLowerCase('pt').match(/\p{L}+/gu)||[];
 const matches=words.filter(word=>common.has(word));
 return matches.length>=3 && matches.some(word=>distinctive.has(word));
}
export function briefingLooksPortuguese(briefing?:{overview?:string;points?:string[];context?:string;limitations?:string}|null) {
 return !!briefing&&looksPortuguese([briefing.overview,...(briefing.points||[]),briefing.context,briefing.limitations].filter(Boolean).join(' '));
}
