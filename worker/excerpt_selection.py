"""Deterministic, exact-source selection; no invented prose or model dependency."""
import re

def select_excerpt(item):
    evidence=' '.join((item.get('excerpt') or item['title']).split())
    existing=' '.join((item.get('summary') or '').split())
    if 10 <= len(existing) <= 600 and existing in evidence:
        return existing
    sentences=[s.strip() for s in re.split(r'(?<=[.!?])\s+',evidence) if len(s.strip())>=10]
    terms=set(re.findall(r'\w{4,}',item['title'].lower()))
    options=[' '.join(s.split()[:45])[:580] for s in (sentences or [evidence])]
    return max(options,key=lambda s:len(terms & set(re.findall(r'\w{4,}',s.lower()))))
