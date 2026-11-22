"""Lightweight key-point checks; no extra inference or publisher requests."""
import re, json, unicodedata

KEY_POINT_GUIDANCE = (' Key points must be distinct, self-contained facts supported by the evidence. '
 'Prefer the central finding and its most consequential supporting fact: include named actors, '
 'numbers with units and dates when supplied. Preserve uncertainty and distinguish observations '
 'from forecasts. Do not repeat the headline or the same fact twice, advertise the source link, '
 'or say the article discusses a topic without stating the finding. With sparse evidence, give '
 'one supported point rather than inventing a second. Silently check each point against the evidence '
 'before returning JSON; never include the check in the output. '
 'Editorial guidance v2: describe public consequences only when supported by source evidence. '
 'Distinguish actual impact from a claim, forecast or promotional language. Identify a city, '
 'region or country only when the source supports it; publisher location is not story location. '
 'Do not call a story a top story, most important, reliable or popular based on model confidence, '
 'feed uptime, repetition, clicks or publication volume. Do not change rankings or weights; '
 'measured feedback informs reviewed proposals, never new facts or autonomous authority.')

class KeyPointQualityError(ValueError):
    pass

def validate_key_points(result):
    points=result.get('points')
    if not isinstance(points,list) or not 1<=len(points)<=4:
        raise KeyPointQualityError('Invalid points')
    seen=[]
    for point in points:
        if not isinstance(point,str) or not 10<=len(point.strip())<=500:
            raise KeyPointQualityError('Invalid point')
        words=set(re.findall(r'\w+',point.lower()))
        if any(len(words & old)/max(1,len(words | old))>=0.85 for old in seen):
            raise KeyPointQualityError('Repeated point')
        if re.match(r'^(?:the )?(?:article|report|source) (?:discusses|covers|talks about)\b',point.strip(),re.I):
            raise KeyPointQualityError('Generic point')
        seen.append(words)
    return result

def validate_briefing_content(content):
    result=validate_key_points(json.loads(content))
    for field,minimum,maximum in [('overview',40,2200),('context',10,600),('limitations',10,600)]:
        if not isinstance(result.get(field),str) or not minimum<=len(result[field].strip())<=maximum:
            raise KeyPointQualityError('Invalid '+field)
    if result['context'].strip().casefold()==result['limitations'].strip().casefold():
        raise KeyPointQualityError('Context and limitations must be distinct')
    return result


def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c))


DAYS = [('monday','segunda-feira'), ('tuesday','terca-feira'), ('wednesday','quarta-feira'),
        ('thursday','quinta-feira'), ('friday','sexta-feira'), ('saturday','sabado'), ('sunday','domingo')]


def weekdays(text):
    return {en for en, pt in DAYS if re.search(r'\b(?:' + en + '|' + pt + r')\b', text)}


def evidence_review_signals(title, evidence, briefing):
    """Advisory signals for validated output. These never gate or retry publication."""
    text = normalize(title + ' ' + evidence)
    source_days = weekdays(text)
    price = re.search(r'(?:€/mwh|eur/mwh|\b(?:precos?|prices?|car[oa]s?)\b)', text)
    demand = re.search(r'\b(demand|procura|consumo|consumption)\b', text)
    reasons = set()
    for field in [briefing['overview'], *briefing['points'], briefing['context']]:
        for clause in re.split(r'[.!?;\n]+', normalize(field)):
            if source_days and weekdays(clause) - source_days:
                reasons.add('weekday_absent')
            if price and not demand and re.search(r'\b(?:electricity|power|energy) demand\b', clause) and re.search(r'\b(?:highs?|record|rose|surged|rising|increase[ds]?)\b', clause):
                reasons.add('price_to_demand')
            for year in re.findall(r'\b(?:first|only)\b.{0,100}\bsince (\d{4})\b', clause):
                if not re.search(r'\b' + year + r'\b', text):
                    reasons.add('unsupported_historical_first')
    return sorted(reasons)
