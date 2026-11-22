import {geographyFor} from './geography';
import {type Item} from './model';
import {metadataCompleteness} from './scoring';

type EditorialScope = 'global' | 'region' | 'city';
const normalize = (s:string) => s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
// Capped public-interest signals, not a fact check or an estimate of lives/money affected.
// A global-sounding headline, repetition or publisher volume cannot supply impact evidence.
export function editorialRelevance(i:Item,scope:EditorialScope='global'){
 const title=i.title,lead=i.excerpt.slice(0,360),text=title+' '+lead;
 // Match the central headline, not a keyword anywhere in an excerpt/newsletter.
 const central=/\b(emergency|evacuat\w*|outbreak|earthquake|flood\w*|wildfire\w*|ceasefire|war|armed conflict|civilian\w*|election\w*|parliament|court|ruling|regulation\w*|treaty|sanctions?|inflation|interest rates?|trade|food security|water supply|electricity|energy supply|climate change|emissions?|public health|clinical trial|vaccine)\b/i.test(title);
 const background=/\b(public health|clinical trial|vaccine|evacuat\w*|ceasefire|court ruling|public policy|regulation\w*|treaty|sanctions?|inflation|interest rates?|trade agreement|food security|water supply|electricity|energy supply|climate change|emissions?)\b/i.test(lead);
 const feature=/\b(ancient|anniversary|roundup|newsletter|opinion|explains why|according to.{0,30}expert|world [\p{L} -]{2,35} day)\b/iu.test(title)||/^(?:welcome back|here are the studies|in this week)/i.test(lead);
 const promotional=/\b(unconfirmed|rumou?r|could revolutioni[sz]e|game.changing|promotional|sponsored|giveaway)\b/i.test(text);
 const usefulDevelopment=/\b(discover\w*|breakthrough|approv\w*|launch\w*|repair\w*|restor\w*|reduc\w*|protect\w*|prevent\w*|cuts? deaths|results?|vulnerabilit\w*|recall\w*)\b/i.test(title);
 const supportedTopic=['Health','Science','Biotech','Tech','AI','Security','Energy','Climate','Economy'].includes(i.topic)||(i.tags||[]).some(t=>['Health','Science','Security','Energy','Climate','Economy'].includes(t));
 const consequence=/\b(patient\w*|treatment\w*|clinical|trial|disease|deaths?|research|study|electricity|energy|water|jobs?|prices?|security|vulnerabilit\w*|emissions?|transport|public)\b/i.test(text);
 const development=usefulDevelopment&&supportedTopic&&consequence;
 const impact=(feature?35:central?90:development?80:background?65:45)-(promotional?15:0);
 const geo=geographyFor({title,excerpt:lead,summary:'',topic:''});
 const crossBorder=/\b(international|worldwide|cross[- ]border|multinational|global (?:economy|trade|health|markets?|climate)|united nations|world health organization)\b/i.test(text);
 const breadth=feature?45:crossBorder&&central?95:geo.countries.length>=2&&central?90:central?75:55;
 return scope==='global'?Math.round(breadth*.4+impact*.6):impact;
}

const events = [
  {reason:'public safety order or change in alert', title:/\b(?:orders? (?:an? |mandatory |immediate )?evacuation|evacuation (?:ordered|lifted)|(?:declares?|lifts?) (?:a |the )?(?:state of emergency|red alert)|(?:declara|levanta|decreta) (?:a |o )?(?:situacao de alerta|estado de emergencia)|alerta vermelho levantado)\b/, support:/\b(?:evacuat\w*|red alert|alerta vermelho|evacu\w*|protecao civil|proteccao civil|emergencia|shelter)\b/},
  {reason:'essential service interruption or restoration',title:/\b(?:restores? (?:power|electricity|water)|without (?:power|drinking water)|sem (?:eletricidade|agua potavel)|restabelec\w* (?:a |o )?(?:energia|abastecimento))\b/,support:/\b(?:households?|residents?|homes|hospitals?|familias|casas|habitantes|moradores)\b/},
  {reason:'reported casualties in a current incident',title:/\b(?:\d+ (?:killed|injured|dead|mortos?|feridos?)|kills (?:at least )?(?:\d+|two|three|four|five)|(?:two|three|four|five|six|eleven) killed)\b/,support:/\b(?:police|rescuers?|attack|strike|hospital\w*|blaze|fire|operation|authorities|probe|incidente|ataque|policia|bombeiros)\b/},
  {reason:'implemented public health measure',title:/\b(?:approv\w*|authori[sz]\w*|aprova\w*|autoriza\w*)\b.{0,45}\b(?:vaccine|treatment|vacina|tratamento)\b/,support:/\b(?:patients?|regulator|regulador|doentes|pacientes|vaccination|vacinacao)\b/}
];
export function eventReason(item:Item) {
  const title = normalize(item.title), lead = normalize(item.excerpt).slice(0,480);
  const conditional = /\b(?:no plans|no evidence|has not|does not|did not|not yet|may|might|could|rumou?r|denies|denied|planned|proposed|drill|anniversary|simulation|simulacro|exercicio|proposta|poderia|nega|nao)\b/;
  if (/[?？]/.test(title) || conditional.test(title) || /\b(?:sponsored|giveaway|patrocinado|paid promotion)\b/.test(title+' '+lead)) return null;
  // Concrete headline action and a supporting lead are both necessary for a boost.
  const rule = events.find(p => p.title.test(title) && p.support.test(lead));
  return rule ? rule.reason : null;
}

// Store source-derived points independently of the claim time and the reader's preferences.
export function editorialBase(item:Item, relevance=editorialRelevance(item)) {
 const completeness = Math.round(metadataCompleteness(item));
 return Math.round((.5 * relevance + .2 * completeness + (eventReason(item) ? 12 : 0)) * 10) / 10;
}
const halfLifeSeconds = 12 * 3600;
export function editorialFreshness(publishedAt:string, at:Date) {
 return Math.round(100 * .5 ** (Math.max(0, +at - Date.parse(publishedAt)) / (1000 * halfLifeSeconds)));
}
export function editorialScore(base:number, freshness:number, feedback=0) {
 return Math.round(10 * Math.max(0, Math.min(100, base + .3 * freshness + feedback))) / 10;
}
// Only fixed query expressions are permitted here. The half-life and weights match daily lead selection.
export function queueScoreSql(phase:'briefing'|'translation') {
 const [points,published] = phase === 'briefing' ? ['s.priority','i.published_at'] : ['priority','coalesce(item_published_at,created_at)'];
 // After eight half-lives freshness rounds to zero. Skip exponentiation for the old backlog.
 const freshness = `CASE WHEN ${published} <= now() - interval '4 days' THEN 0 ELSE round(100 * power(0.5::numeric, greatest(0,extract(epoch from (now() - ${published}))) / ${halfLifeSeconds})) END`;
 return `least(100, ${points} + 0.3 * (${freshness}))`;
}
