"""Bound successful-job idle time without accelerating failures or empty polling."""
import math

def briefing_delay(completed, configured=5):
    if not completed:
        return 15
    if isinstance(configured,bool) or not isinstance(configured,(int,float)) or not math.isfinite(configured):
        return 5
    return max(5,min(15,configured))
