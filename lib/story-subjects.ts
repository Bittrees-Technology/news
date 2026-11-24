// Only report subjects supported by a phrase in the original headline or excerpt.
const subjects = [
  { id:'energy.grid.outage', label:'Grid outages', pt:'Falhas na rede elétrica', parent:'Energy', pattern:/\b(?:power outages?|power cuts?|electricity blackouts?|apag[aã]o|apagões|cortes? de energia)\b/iu },
  { id:'energy.renewables.solar', label:'Solar power', pt:'Energia solar', parent:'Energy', pattern:/\b(?:solar (?:power|farms?|panels?)|energia solar|painéis solares)\b/iu },
  { id:'economy.monetary.rates', label:'Interest rates', pt:'Taxas de juro', parent:'Economy', pattern:/\b(?:interest rates?|taxas? de juros?)\b/iu },
  { id:'climate.hazards.floods', label:'Flooding', pt:'Inundações', parent:'Climate', pattern:/\b(?:flash floods?|floodwaters?|flooding|inundações|cheias repentinas)\b/iu },
  { id:'space.launch', label:'Space launches', pt:'Lançamentos espaciais', parent:'Space', pattern:/\b(?:rocket launch(?:es)?|satellite launch(?:es)?|lançamento (?:de satélite|espacial))\b/iu },
  { id:'health.vaccination', label:'Vaccination', pt:'Vacinação', parent:'Health', pattern:/\b(?:vaccination campaign|vaccine rollout|campanha de vacinação)\b/iu },
  { id:'civics.election', label:'Elections', pt:'Eleições', parent:'Politics', pattern:/\b(?:general election|presidential election|legislative election|eleições (?:legislativas|presidenciais|gerais))\b/iu }
];
export function subjectEvidence(article: {title:string;excerpt:string}) {
  return subjects.flatMap(({pattern,...subject}) => {
    for (const field of ['title','excerpt'] as const) {
      const match = pattern.exec(article[field] || '');
      if (match) return [{...subject,field,start:match.index,end:match.index+match[0].length}];
    }
    return [];
  });
}
export const subjectLabels=subjects.map(s=>s.label);
