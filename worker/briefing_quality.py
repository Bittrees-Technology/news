"""Lightweight key-point checks; no extra inference or publisher requests."""
import re, json

KEY_POINT_GUIDANCE = (' Key points must be distinct, self-contained facts supported by the evidence. '
 'Prefer the central finding and its most consequential supporting fact: include named actors, '
 'numbers with units and dates when supplied. Preserve uncertainty and distinguish observations '
 'from forecasts. Do not repeat the headline or the same fact twice, advertise the source link, '
 'or say the article discusses a topic without stating the finding. With sparse evidence, give '
 'one supported point rather than inventing a second. Silently check each point against the evidence '
 'before returning JSON; never include the check in the output.')

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
    return validate_key_points(json.loads(content))
